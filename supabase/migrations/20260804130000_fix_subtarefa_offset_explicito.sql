-- =============================================================================
-- Deslocamento explícito da subtarefa (offset_dias / dia_no_mes) passa a valer
-- =============================================================================
-- Bug: as colunas `offset_dias` e `dia_no_mes` da subtarefa-template (editadas
-- no modelo da série, tela Recorrentes) eram usadas SOMENTE na prévia do
-- cliente ("Em breve" / Calendário — `dataSubtarefaNaOcorrencia` em
-- src/utils/recorrencia.ts). A materialização real no servidor
-- (`recorrencia_clonar_subtarefas` / `recorrencia_sincronizar_subtarefas`)
-- ignorava essas colunas e calculava um deslocamento IMPLÍCITO a partir do
-- campo legado `data_inicio` da própria subtarefa-template — ou seja, o campo
-- que o usuário configurava na tela não tinha efeito nenhum nas subtarefas
-- de fato criadas.
--
-- Agora ambas as funções passam a priorizar os campos explícitos:
--   1) dia_no_mes  → dia fixo do mês (clampado ao último dia do mês), mantido
--                    só por compatibilidade com dados antigos;
--   2) offset_dias → soma direta de dias à data da ocorrência da tarefa pai
--                    (comportamento pedido: "tarefa pai +N dias", válido para
--                    qualquer tipo de recorrência — diária, semanal, mensal,
--                    anual, personalizada);
--   3) sem nenhum dos dois → cálculo implícito legado (compatibilidade).
-- =============================================================================

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
  v_last_day int;
  v_criadas int := 0;
begin
  for v_sub in
    select *
    from public.subtarefas
    where tarefa_id = p_modelo_id
    order by posicao asc, created_at asc
  loop
    v_data := null;
    v_hora := coalesce(
      date_trunc('minute', (v_sub.data_inicio at time zone v_tz))::time,
      time '12:00'
    );

    if v_sub.dia_no_mes is not null then
      v_last_day := extract(
        day from ((date_trunc('month', p_ocorrencia_dia) + interval '1 month - 1 day'))
      )::int;
      v_dia := make_date(
        extract(year from p_ocorrencia_dia)::int,
        extract(month from p_ocorrencia_dia)::int,
        least(greatest(v_sub.dia_no_mes, 1), v_last_day)
      );
      v_data := (v_dia + v_hora) at time zone v_tz;
    elsif v_sub.offset_dias is not null then
      v_dia := p_ocorrencia_dia + v_sub.offset_dias;
      v_data := (v_dia + v_hora) at time zone v_tz;
    elsif v_sub.data_inicio is not null then
      v_offset := public.recorrencia_offset_subtarefa(
        (v_sub.data_inicio at time zone v_tz)::date,
        p_ancora,
        p_config
      );
      if v_offset is not null then
        v_dia := p_ocorrencia_dia + v_offset;
        v_data := (v_dia + v_hora) at time zone v_tz;
      end if;
    end if;

    v_nova_id := gen_random_uuid();

    insert into public.subtarefas (
      id, tarefa_id, titulo, descricao, prioridade, data_inicio,
      projeto_id, setor_id, visibilidade, lembretes, recorrencia,
      posicao, concluida, concluido_por, criado_por, origem_subtarefa_id
    ) values (
      v_nova_id, p_ocorrencia_id, v_sub.titulo, v_sub.descricao, v_sub.prioridade, v_data,
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

    v_criadas := v_criadas + 1;
  end loop;

  return v_criadas;
end;
$$;

comment on function public.recorrencia_clonar_subtarefas(uuid, uuid, date, date, jsonb) is
  'Clona as subtarefas-template do modelo para uma ocorrência. Prioriza dia_no_mes/offset_dias explícitos; sem eles, usa o deslocamento implícito legado a partir de data_inicio.';

-- -----------------------------------------------------------------------------
-- Sincronização das ocorrências abertas (hoje em diante) — mesma prioridade
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
    select o.id, (o.data_inicio at time zone v_tz)::date as dia
    from public.tarefas o
    where o.serie_raiz_id = v_modelo.id
      and o.id <> v_modelo.id
      and o.deleted_at is null
      and o.concluida = false
      and o.data_inicio is not null
      and (o.data_inicio at time zone v_tz)::date >= v_hoje
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
  'Alinha as subtarefas das ocorrências abertas (hoje em diante) ao template do modelo. Prioriza dia_no_mes/offset_dias explícitos; sem eles, usa o deslocamento implícito legado a partir de data_inicio.';

-- -----------------------------------------------------------------------------
-- Aplica a correção imediatamente às ocorrências já materializadas e abertas
-- -----------------------------------------------------------------------------
do $do$
declare
  v_modelo record;
begin
  for v_modelo in
    select id
    from public.tarefas
    where deleted_at is null
      and recorrencia is not null
      and serie_raiz_id is not null
      and serie_raiz_id = id
  loop
    perform public.recorrencia_sincronizar_subtarefas(v_modelo.id);
  end loop;
end
$do$;
