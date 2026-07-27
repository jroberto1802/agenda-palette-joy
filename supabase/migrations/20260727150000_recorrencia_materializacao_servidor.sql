-- =============================================================================
-- Materialização de ocorrências de recorrência no servidor
-- =============================================================================
-- Antes: a materialização acontecia apenas no navegador (hook React). Só rodava
-- quando alguém com permissão de leitura E escrita no modelo abria o app, e
-- gravava `criado_por` = usuário logado. Sem ninguém logado, nada era gerado.
--
-- Agora: motor de recorrência em SQL + job diário (00:05 America/Sao_Paulo).
-- O modelo da série (serie_raiz_id = id) nunca é ocorrência; cada data devida
-- gera uma linha filha com o conjunto de subtarefas do modelo (offset em dias).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Próxima data da regra, estritamente após `p_atual`
-- Espelha `calcularProximaData` (src/utils/recorrencia.ts)
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_proxima_data(
  p_atual date,
  p_config jsonb
)
returns date
language plpgsql
immutable
as $$
declare
  v_tipo text := coalesce(p_config->>'tipo', 'nenhuma');
  v_dias int[];
  v_dia_mes int;
  v_intervalo int;
  v_unidade text;
  v_base date;
  v_cand date;
  v_next text;
  i int;
begin
  if p_atual is null or v_tipo = 'nenhuma' then
    return null;
  end if;

  if v_tipo = 'diaria' then
    return p_atual + 1;
  end if;

  if v_tipo = 'semanal' then
    select coalesce(array_agg(x::int), '{}'::int[])
      into v_dias
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(p_config->'dias_semana') = 'array' then p_config->'dias_semana'
          else '[]'::jsonb
        end
      ) as t(x);

    if coalesce(array_length(v_dias, 1), 0) = 0 then
      v_dias := array[extract(dow from p_atual)::int];
    end if;

    for i in 1..14 loop
      v_cand := p_atual + i;
      if extract(dow from v_cand)::int = any (v_dias) then
        return v_cand;
      end if;
    end loop;

    return p_atual + 7;
  end if;

  if v_tipo = 'mensal' then
    v_dia_mes := coalesce((p_config->>'dia_mes')::int, extract(day from p_atual)::int);
    v_base := (p_atual + interval '1 month')::date;
    return make_date(
      extract(year from v_base)::int,
      extract(month from v_base)::int,
      least(greatest(v_dia_mes, 1), 28)
    );
  end if;

  if v_tipo = 'anual' then
    v_intervalo := greatest(coalesce((p_config->>'intervalo')::int, 1), 1);
    return (p_atual + make_interval(years => v_intervalo))::date;
  end if;

  if v_tipo = 'personalizada' then
    if jsonb_typeof(p_config->'datas_livres') = 'array'
       and jsonb_array_length(p_config->'datas_livres') > 0 then
      select min(x)
        into v_next
        from jsonb_array_elements_text(p_config->'datas_livres') as t(x)
        where x > to_char(p_atual, 'YYYY-MM-DD');
      if v_next is null then
        return null;
      end if;
      return v_next::date;
    end if;

    v_intervalo := greatest(coalesce((p_config->>'intervalo')::int, 1), 1);
    v_unidade := p_config->>'unidade';

    if v_unidade = 'semanas' then
      return (p_atual + make_interval(weeks => v_intervalo))::date;
    end if;
    if v_unidade = 'meses' then
      return (p_atual + make_interval(months => v_intervalo))::date;
    end if;
    return p_atual + v_intervalo;
  end if;

  return null;
end;
$$;

comment on function public.recorrencia_proxima_data(date, jsonb) is
  'Próxima data da regra de recorrência, estritamente após p_atual.';

-- -----------------------------------------------------------------------------
-- Expansão das datas de ocorrência em [p_de, p_ate]
-- Espelha `expandirDatasOcorrencia` (src/utils/recorrencia.ts)
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_expandir_datas(
  p_ancora date,
  p_config jsonb,
  p_de date,
  p_ate date,
  p_max integer default 366
)
returns setof date
language plpgsql
stable
as $$
declare
  v_tipo text := coalesce(p_config->>'tipo', 'nenhuma');
  v_max int := greatest(coalesce(p_max, 366), 1);
  v_fim date := nullif(p_config->>'data_fim', '')::date;
  v_count int := 0;
  v_guard int := 0;
  v_cursor date;
  v_next date;
  v_livre text;
begin
  if v_tipo = 'nenhuma' or p_de is null or p_ate is null or p_de > p_ate then
    return;
  end if;

  -- Datas livres não usam o motor: são a própria lista
  if v_tipo = 'personalizada'
     and jsonb_typeof(p_config->'datas_livres') = 'array'
     and jsonb_array_length(p_config->'datas_livres') > 0 then
    for v_livre in
      select t.x
      from jsonb_array_elements_text(p_config->'datas_livres') as t(x)
      order by t.x
    loop
      v_cursor := nullif(v_livre, '')::date;
      if v_cursor is null then
        continue;
      end if;
      if v_cursor < p_de or v_cursor > p_ate then
        continue;
      end if;
      if v_fim is not null and v_cursor > v_fim then
        continue;
      end if;
      return next v_cursor;
      v_count := v_count + 1;
      exit when v_count >= v_max;
    end loop;
    return;
  end if;

  v_cursor := coalesce(p_ancora, p_de);

  -- Avança da âncora até a janela pedida
  while v_cursor < p_de and v_guard < 5000 loop
    v_next := public.recorrencia_proxima_data(v_cursor, p_config);
    if v_next is null then
      return;
    end if;
    if v_fim is not null and v_next > v_fim then
      return;
    end if;
    v_cursor := v_next;
    v_guard := v_guard + 1;
  end loop;

  if v_cursor >= p_de
     and v_cursor <= p_ate
     and (v_fim is null or v_cursor <= v_fim) then
    return next v_cursor;
    v_count := v_count + 1;
  end if;

  while v_count < v_max loop
    v_next := public.recorrencia_proxima_data(v_cursor, p_config);
    if v_next is null then
      exit;
    end if;
    if v_fim is not null and v_next > v_fim then
      exit;
    end if;
    v_cursor := v_next;
    exit when v_cursor > p_ate;
    if v_cursor >= p_de then
      return next v_cursor;
      v_count := v_count + 1;
    end if;
  end loop;

  return;
end;
$$;

comment on function public.recorrencia_expandir_datas(date, jsonb, date, date, integer) is
  'Datas de ocorrência da série no intervalo [p_de, p_ate], a partir da âncora.';

-- -----------------------------------------------------------------------------
-- Offset (dias) da subtarefa-modelo em relação à ocorrência do mesmo ciclo
-- Espelha `offsetDiasSubtarefaNoCiclo` (src/utils/recorrencia.ts)
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_offset_subtarefa(
  p_subtarefa_dia date,
  p_ancora date,
  p_config jsonb
)
returns integer
language plpgsql
stable
as $$
declare
  v_pai date;
  v_offset int;
begin
  if p_subtarefa_dia is null then
    return null;
  end if;
  if p_ancora is null then
    return 0;
  end if;

  select max(d)
    into v_pai
    from public.recorrencia_expandir_datas(
      p_ancora, p_config, p_ancora, p_subtarefa_dia, 600
    ) as d;

  v_pai := coalesce(v_pai, p_ancora);
  v_offset := p_subtarefa_dia - v_pai;

  -- Deslocamento típico dentro do ciclo (não meses à frente)
  if v_offset < 0 or v_offset > 31 then
    return null;
  end if;

  return v_offset;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clona o conjunto de subtarefas do modelo para uma ocorrência
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_clonar_subtarefas(
  p_modelo_id uuid,
  p_ocorrencia_id uuid,
  p_ancora date,
  p_ocorrencia_dia date,
  p_config jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_sub record;
  v_nova_id uuid;
  v_offset int;
  v_dia date;
  v_hora time;
  v_data timestamptz;
  v_criadas int := 0;
begin
  for v_sub in
    select *
    from public.subtarefas
    where tarefa_id = p_modelo_id
    order by posicao asc, created_at asc
  loop
    v_data := null;

    if v_sub.data_inicio is not null then
      v_offset := public.recorrencia_offset_subtarefa(
        (v_sub.data_inicio at time zone v_tz)::date,
        p_ancora,
        p_config
      );
      if v_offset is not null then
        v_dia := p_ocorrencia_dia + v_offset;
        v_hora := coalesce(
          date_trunc('minute', (v_sub.data_inicio at time zone v_tz))::time,
          time '12:00'
        );
        v_data := (v_dia + v_hora) at time zone v_tz;
      end if;
    end if;

    v_nova_id := gen_random_uuid();

    insert into public.subtarefas (
      id, tarefa_id, titulo, descricao, prioridade, data_inicio,
      projeto_id, setor_id, visibilidade, lembretes, recorrencia,
      posicao, concluida, concluido_por, criado_por
    ) values (
      v_nova_id, p_ocorrencia_id, v_sub.titulo, v_sub.descricao, v_sub.prioridade, v_data,
      v_sub.projeto_id, v_sub.setor_id, v_sub.visibilidade, v_sub.lembretes, null,
      v_sub.posicao, false, null, v_sub.criado_por
    );

    insert into public.subtarefa_responsaveis (subtarefa_id, usuario_id)
    select v_nova_id, r.usuario_id
    from public.subtarefa_responsaveis r
    where r.subtarefa_id = v_sub.id
    on conflict do nothing;

    insert into public.subtarefa_observadores (subtarefa_id, usuario_id)
    select v_nova_id, o.usuario_id
    from public.subtarefa_observadores o
    where o.subtarefa_id = v_sub.id
    on conflict do nothing;

    v_criadas := v_criadas + 1;
  end loop;

  return v_criadas;
end;
$$;

-- -----------------------------------------------------------------------------
-- Recalcula `data_inicio` do modelo para a próxima data devida SEM ocorrência
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_atualizar_proxima_data(
  p_modelo_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_hoje date := (now() at time zone v_tz)::date;
  v_modelo record;
  v_config jsonb;
  v_ancora date;
  v_hora time;
  v_proxima date;
begin
  select *
    into v_modelo
    from public.tarefas
    where id = p_modelo_id
      and deleted_at is null
      and serie_raiz_id = id;

  if not found then
    return;
  end if;

  v_config := v_modelo.recorrencia;
  if v_config is null or coalesce(v_config->>'tipo', 'nenhuma') = 'nenhuma' then
    return;
  end if;

  v_ancora := coalesce(
    nullif(v_config->>'data_ancora', '')::date,
    (v_modelo.data_inicio at time zone v_tz)::date
  );
  if v_ancora is null then
    return;
  end if;

  v_hora := coalesce(
    date_trunc('minute', (v_modelo.data_inicio at time zone v_tz))::time,
    time '12:00'
  );

  select min(d)
    into v_proxima
    from public.recorrencia_expandir_datas(
      v_ancora, v_config, v_hoje, v_hoje + 366, 400
    ) as d
    where not exists (
      select 1
      from public.tarefas o
      where o.serie_raiz_id = v_modelo.id
        and o.id <> v_modelo.id
        and o.deleted_at is null
        and (o.data_inicio at time zone v_tz)::date = d
    );

  update public.tarefas
  set
    data_inicio = case
      when v_proxima is null then null
      else (v_proxima + v_hora) at time zone v_tz
    end,
    recorrencia = v_config || jsonb_build_object(
      'data_ancora', to_char(v_ancora, 'YYYY-MM-DD')
    ),
    concluida = false,
    data_conclusao = null
  where id = v_modelo.id;
end;
$$;

comment on function public.recorrencia_atualizar_proxima_data(uuid) is
  'Aponta o modelo da série para a próxima data devida que ainda não tem ocorrência.';

-- -----------------------------------------------------------------------------
-- Job principal: materializa todas as ocorrências devidas (data <= hoje)
-- -----------------------------------------------------------------------------
create or replace function public.materializar_ocorrencias_recorrencia(
  p_dias_retroativos integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_hoje date := (now() at time zone v_tz)::date;
  v_retro int := greatest(coalesce(p_dias_retroativos, 30), 0);
  v_modelo record;
  v_config jsonb;
  v_ancora date;
  v_de date;
  v_hora time;
  v_dia date;
  v_ts timestamptz;
  v_nova_id uuid;
  v_criadas int := 0;
begin
  -- Serializa execuções concorrentes (job + catch-up do app) na transação
  perform pg_advisory_xact_lock(hashtext('materializar_ocorrencias_recorrencia'));

  for v_modelo in
    select *
    from public.tarefas t
    where t.deleted_at is null
      and t.recorrencia is not null
      and t.serie_raiz_id is not null
      and t.serie_raiz_id = t.id
    order by t.created_at asc
  loop
    v_config := v_modelo.recorrencia;

    if coalesce(v_config->>'tipo', 'nenhuma') = 'nenhuma' then
      continue;
    end if;

    -- O modelo é permanente: nunca fica concluído
    if v_modelo.concluida then
      update public.tarefas
      set concluida = false, data_conclusao = null
      where id = v_modelo.id;
    end if;

    -- Âncora estável da série (persistida na regra)
    v_ancora := nullif(v_config->>'data_ancora', '')::date;
    if v_ancora is null then
      v_ancora := (v_modelo.data_inicio at time zone v_tz)::date;
      if v_ancora is null then
        continue;
      end if;
      v_config := v_config || jsonb_build_object(
        'data_ancora', to_char(v_ancora, 'YYYY-MM-DD')
      );
      update public.tarefas set recorrencia = v_config where id = v_modelo.id;
    end if;

    v_hora := coalesce(
      date_trunc('minute', (v_modelo.data_inicio at time zone v_tz))::time,
      time '12:00'
    );

    -- Backfill limitado: evita explodir a série ao ligar o job em bases antigas
    v_de := greatest(v_ancora, v_hoje - v_retro);

    for v_dia in
      select d
      from public.recorrencia_expandir_datas(v_ancora, v_config, v_de, v_hoje, 400) as d
    loop
      if exists (
        select 1
        from public.tarefas o
        where o.serie_raiz_id = v_modelo.id
          and o.id <> v_modelo.id
          and o.deleted_at is null
          and (o.data_inicio at time zone v_tz)::date = v_dia
      ) then
        continue;
      end if;

      v_ts := (v_dia + v_hora) at time zone v_tz;
      v_nova_id := gen_random_uuid();

      insert into public.tarefas (
        id, titulo, descricao, projeto_id, setor_id, criado_por, atribuido_a,
        prioridade, concluida, data_inicio, data_conclusao, tags, recorrencia,
        serie_raiz_id, visibilidade, lembretes
      ) values (
        v_nova_id, v_modelo.titulo, v_modelo.descricao, v_modelo.projeto_id,
        v_modelo.setor_id, v_modelo.criado_por, v_modelo.atribuido_a,
        v_modelo.prioridade, false, v_ts, null, v_modelo.tags, null,
        v_modelo.id, v_modelo.visibilidade, v_modelo.lembretes
      );

      insert into public.tarefa_responsaveis (tarefa_id, usuario_id)
      select v_nova_id, r.usuario_id
      from public.tarefa_responsaveis r
      where r.tarefa_id = v_modelo.id
      on conflict do nothing;

      insert into public.tarefa_observadores (tarefa_id, usuario_id)
      select v_nova_id, o.usuario_id
      from public.tarefa_observadores o
      where o.tarefa_id = v_modelo.id
      on conflict do nothing;

      perform public.recorrencia_clonar_subtarefas(
        v_modelo.id, v_nova_id, v_ancora, v_dia, v_config
      );

      v_criadas := v_criadas + 1;
    end loop;

    perform public.recorrencia_atualizar_proxima_data(v_modelo.id);
  end loop;

  return v_criadas;
end;
$$;

comment on function public.materializar_ocorrencias_recorrencia(integer) is
  'Cria as ocorrências devidas (até hoje, America/Sao_Paulo) de todas as séries ativas, com o conjunto de subtarefas por offset.';

-- -----------------------------------------------------------------------------
-- Índice de apoio à checagem "já existe ocorrência neste dia?"
-- -----------------------------------------------------------------------------
create index if not exists tarefas_serie_data_inicio_idx
  on public.tarefas (serie_raiz_id, data_inicio)
  where deleted_at is null and serie_raiz_id is not null;

-- -----------------------------------------------------------------------------
-- Permissões: o app chama como catch-up ao abrir; o job roda como postgres
-- -----------------------------------------------------------------------------
revoke all on function public.materializar_ocorrencias_recorrencia(integer) from public;
revoke all on function public.recorrencia_atualizar_proxima_data(uuid) from public;
revoke all on function public.recorrencia_clonar_subtarefas(uuid, uuid, date, date, jsonb) from public;

grant execute on function public.materializar_ocorrencias_recorrencia(integer)
  to authenticated, service_role;
grant execute on function public.recorrencia_atualizar_proxima_data(uuid)
  to authenticated, service_role;
grant execute on function public.recorrencia_proxima_data(date, jsonb)
  to authenticated, service_role;
grant execute on function public.recorrencia_expandir_datas(date, jsonb, date, date, integer)
  to authenticated, service_role;
grant execute on function public.recorrencia_offset_subtarefa(date, date, jsonb)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Agendamento diário às 00:05 America/Sao_Paulo (03:05 UTC)
-- Se pg_cron não estiver disponível, o catch-up do app cobre a geração.
-- -----------------------------------------------------------------------------
do $do$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception
    when others then
      raise notice 'pg_cron indisponível (%). O catch-up do app assume a geração.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1 from cron.job where jobname = 'materializar-recorrencias-diario'
    ) then
      perform cron.unschedule('materializar-recorrencias-diario');
    end if;

    perform cron.schedule(
      'materializar-recorrencias-diario',
      '5 3 * * *',
      $job$select public.materializar_ocorrencias_recorrencia();$job$
    );
  end if;
end
$do$;

-- Primeira execução: só o dia de hoje, para não despejar meses de atraso
-- acumulado de séries que nunca foram materializadas.
select public.materializar_ocorrencias_recorrencia(0);
