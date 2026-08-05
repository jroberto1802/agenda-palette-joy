-- =============================================================================
-- Ocorrência de recorrência: data de origem imutável (idempotência real)
-- =============================================================================
-- Antes, "esta data já foi materializada?" era respondido comparando o dia de
-- `data_inicio` da ocorrência. Reagendar uma ocorrência (ex.: quinta 30/07 para
-- 05/08) fazia o dia 30/07 voltar a parecer pendente e o motor criava uma
-- SEGUNDA ocorrência da mesma quinta-feira.
--
-- Agora cada ocorrência guarda `recorrencia_data_origem`: a data prevista pela
-- regra que a gerou. Essa coluna nunca muda (trigger garante), e passa a ser:
--   1. a chave de idempotência da materialização;
--   2. a informação de "origem da recorrência" exibida na interface.
--
-- Consequência desejada: uma data prevista gera UMA única tarefa. Depois de
-- gerada, a ocorrência é independente — data, responsável, prioridade etc.
-- podem ser alterados sem afetar a regra nem as outras ocorrências, e sem
-- disparar uma nova geração para a mesma data.
-- =============================================================================

alter table public.tarefas
  add column if not exists recorrencia_data_origem date;

comment on column public.tarefas.recorrencia_data_origem is
  'Data originalmente prevista pela regra de recorrência que gerou esta ocorrência. Imutável: reagendar altera data_inicio, nunca esta coluna.';

-- Ocorrências já existentes: assume o dia atual como origem (melhor aproximação
-- possível — antes desta migração a origem não era registrada).
-- Desativa temporariamente a proteção de tarefas concluídas: o backfill só
-- preenche recorrencia_data_origem e não altera conteúdo operacional.
alter table public.tarefas disable trigger tarefas_protect_edicao_reabertura_concluida;

update public.tarefas o
set recorrencia_data_origem = (o.data_inicio at time zone 'America/Sao_Paulo')::date
where o.serie_raiz_id is not null
  and o.serie_raiz_id <> o.id
  and o.data_inicio is not null
  and o.recorrencia_data_origem is null;

alter table public.tarefas enable trigger tarefas_protect_edicao_reabertura_concluida;

create index if not exists tarefas_serie_origem_idx
  on public.tarefas (serie_raiz_id, recorrencia_data_origem);

-- -----------------------------------------------------------------------------
-- Origem nunca é perdida: reagendar/editar/concluir não apaga a referência
-- -----------------------------------------------------------------------------
create or replace function public.tarefas_preservar_data_origem()
returns trigger
language plpgsql
as $$
begin
  if old.recorrencia_data_origem is not null
     and new.recorrencia_data_origem is null then
    new.recorrencia_data_origem := old.recorrencia_data_origem;
  end if;
  return new;
end;
$$;

comment on function public.tarefas_preservar_data_origem() is
  'Impede que tarefas.recorrencia_data_origem seja apagada em updates da ocorrência (reagendamento, edição, conclusão).';

drop trigger if exists tarefas_preservar_data_origem_trg on public.tarefas;

create trigger tarefas_preservar_data_origem_trg
before update on public.tarefas
for each row
execute function public.tarefas_preservar_data_origem();

-- -----------------------------------------------------------------------------
-- Materialização: idempotente pela data de origem
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
      -- Uma data prevista gera UMA ocorrência, para sempre. A comparação é pela
      -- origem (não por data_inicio): ocorrência reagendada continua ocupando a
      -- data que a gerou. Ocorrência excluída também conta — data já gerada não
      -- volta sozinha.
      if exists (
        select 1
        from public.tarefas o
        where o.serie_raiz_id = v_modelo.id
          and o.id <> v_modelo.id
          and coalesce(
            o.recorrencia_data_origem,
            (o.data_inicio at time zone v_tz)::date
          ) = v_dia
      ) then
        continue;
      end if;

      v_ts := (v_dia + v_hora) at time zone v_tz;
      v_nova_id := gen_random_uuid();

      insert into public.tarefas (
        id, titulo, descricao, projeto_id, setor_id, criado_por, atribuido_a,
        prioridade, concluida, data_inicio, data_conclusao, tags, recorrencia,
        serie_raiz_id, recorrencia_data_origem, visibilidade, lembretes
      ) values (
        v_nova_id, v_modelo.titulo, v_modelo.descricao, v_modelo.projeto_id,
        v_modelo.setor_id, v_modelo.criado_por, v_modelo.atribuido_a,
        v_modelo.prioridade, false, v_ts, null, v_modelo.tags, null,
        v_modelo.id, v_dia, v_modelo.visibilidade, v_modelo.lembretes
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

    perform public.recorrencia_sincronizar_subtarefas(v_modelo.id);
    perform public.recorrencia_atualizar_proxima_data(v_modelo.id);
  end loop;

  return v_criadas;
end;
$$;

comment on function public.materializar_ocorrencias_recorrencia(integer) is
  'Materializa as ocorrências devidas de todas as séries ativas. Idempotente por (serie_raiz_id, recorrencia_data_origem): cada data prevista gera uma única tarefa, mesmo que ela seja reagendada ou excluída depois.';

-- -----------------------------------------------------------------------------
-- Próxima data prevista do modelo: também pela data de origem
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
        and coalesce(
          o.recorrencia_data_origem,
          (o.data_inicio at time zone v_tz)::date
        ) = d
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
  'Aponta o modelo da série para a próxima data prevista que ainda não foi materializada (comparação por recorrencia_data_origem).';

-- -----------------------------------------------------------------------------
-- Sincronização de subtarefas: não toca em ocorrência reagendada
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_sincronizar_subtarefas(
  p_modelo_id uuid
)
returns integer
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
  v_ocorrencia record;
  v_sub record;
  v_nova_id uuid;
  v_offset int;
  v_hora time;
  v_dia date;
  v_last_day int;
  v_data timestamptz;
  v_alteradas int := 0;
begin
  select *
    into v_modelo
    from public.tarefas
    where id = p_modelo_id
      and deleted_at is null
      and serie_raiz_id = id;

  if not found then
    return 0;
  end if;

  v_config := v_modelo.recorrencia;
  if v_config is null or coalesce(v_config->>'tipo', 'nenhuma') = 'nenhuma' then
    return 0;
  end if;

  v_ancora := coalesce(
    nullif(v_config->>'data_ancora', '')::date,
    (v_modelo.data_inicio at time zone v_tz)::date
  );
  if v_ancora is null then
    return 0;
  end if;

  for v_ocorrencia in
    select
      o.id,
      coalesce(
        o.recorrencia_data_origem,
        (o.data_inicio at time zone v_tz)::date
      ) as dia
    from public.tarefas o
    where o.serie_raiz_id = v_modelo.id
      and o.id <> v_modelo.id
      and o.deleted_at is null
      and o.concluida = false
      and o.data_inicio is not null
      and (o.data_inicio at time zone v_tz)::date >= v_hoje
      -- Ocorrência reagendada é independente: o template do modelo não mexe
      -- mais nas datas dela.
      and coalesce(
        o.recorrencia_data_origem,
        (o.data_inicio at time zone v_tz)::date
      ) = (o.data_inicio at time zone v_tz)::date
  loop
    -- Template removido do modelo: remove a cópia ainda aberta
    delete from public.subtarefas c
    where c.tarefa_id = v_ocorrencia.id
      and c.origem_subtarefa_id is not null
      and c.concluida = false
      and not exists (
        select 1
        from public.subtarefas m
        where m.id = c.origem_subtarefa_id
          and m.tarefa_id = v_modelo.id
      );

    for v_sub in
      select *
      from public.subtarefas
      where tarefa_id = v_modelo.id
      order by posicao asc, created_at asc
    loop
      v_data := null;
      v_hora := coalesce(
        date_trunc('minute', (v_sub.data_inicio at time zone v_tz))::time,
        time '12:00'
      );

      if v_sub.dia_no_mes is not null then
        v_last_day := extract(
          day from ((date_trunc('month', v_ocorrencia.dia) + interval '1 month - 1 day'))
        )::int;
        v_dia := make_date(
          extract(year from v_ocorrencia.dia)::int,
          extract(month from v_ocorrencia.dia)::int,
          least(greatest(v_sub.dia_no_mes, 1), v_last_day)
        );
        v_data := (v_dia + v_hora) at time zone v_tz;
      elsif v_sub.offset_dias is not null then
        v_dia := v_ocorrencia.dia + v_sub.offset_dias;
        v_data := (v_dia + v_hora) at time zone v_tz;
      elsif coalesce(v_config->>'tipo', 'nenhuma') = 'diaria' then
        v_data := (v_ocorrencia.dia + v_hora) at time zone v_tz;
      elsif v_sub.data_inicio is not null then
        v_offset := public.recorrencia_offset_subtarefa(
          (v_sub.data_inicio at time zone v_tz)::date,
          v_ancora,
          v_config
        );
        if v_offset is not null then
          v_data := ((v_ocorrencia.dia + v_offset) + v_hora) at time zone v_tz;
        end if;
      end if;

      update public.subtarefas c
      set
        titulo = v_sub.titulo,
        descricao = v_sub.descricao,
        prioridade = v_sub.prioridade,
        data_inicio = v_data,
        projeto_id = v_sub.projeto_id,
        setor_id = v_sub.setor_id,
        visibilidade = v_sub.visibilidade,
        lembretes = v_sub.lembretes,
        posicao = v_sub.posicao
      where c.tarefa_id = v_ocorrencia.id
        and c.origem_subtarefa_id = v_sub.id
        and c.concluida = false;

      if found then
        v_alteradas := v_alteradas + 1;
        continue;
      end if;

      -- Sem cópia aberta: só cria se também não houver cópia concluída
      if exists (
        select 1
        from public.subtarefas c
        where c.tarefa_id = v_ocorrencia.id
          and c.origem_subtarefa_id = v_sub.id
      ) then
        continue;
      end if;

      v_nova_id := gen_random_uuid();

      insert into public.subtarefas (
        id, tarefa_id, titulo, descricao, prioridade, data_inicio,
        projeto_id, setor_id, visibilidade, lembretes, recorrencia,
        posicao, concluida, concluido_por, criado_por, origem_subtarefa_id
      ) values (
        v_nova_id, v_ocorrencia.id, v_sub.titulo, v_sub.descricao, v_sub.prioridade, v_data,
        v_sub.projeto_id, v_sub.setor_id, v_sub.visibilidade, v_sub.lembretes, null,
        v_sub.posicao, false, null, v_sub.criado_por, v_sub.id
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

      v_alteradas := v_alteradas + 1;
    end loop;
  end loop;

  return v_alteradas;
end;
$$;

comment on function public.recorrencia_sincronizar_subtarefas(uuid) is
  'Alinha as subtarefas das ocorrências abertas e ainda não reagendadas (hoje em diante) ao template do modelo. Ocorrência reagendada é independente e não é mais sincronizada. Datas: dia_no_mes/offset_dias explícitos; diária sem deslocamento usa o dia da ocorrência; senão, deslocamento implícito legado.';
