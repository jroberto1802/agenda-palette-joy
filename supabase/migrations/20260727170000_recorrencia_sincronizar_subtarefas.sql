-- =============================================================================
-- Subtarefas da ocorrência acompanham o template do modelo
-- =============================================================================
-- Ao criar uma tarefa com recorrência cuja próxima data é hoje, a ocorrência é
-- materializada na hora — antes de o usuário montar as subtarefas no modelo.
-- Sem sincronização, a ocorrência do dia ficava sem o conjunto de subtarefas.
--
-- `origem_subtarefa_id` liga a cópia da ocorrência à subtarefa-template. É uuid
-- solto (sem FK) de propósito: o vínculo precisa sobreviver à exclusão do
-- template, para que a sincronização saiba remover a cópia correspondente.
--
-- Escopo da sincronização: só ocorrências de hoje em diante e ainda abertas.
-- Ocorrências passadas e subtarefas concluídas são histórico — nunca mudam.
-- =============================================================================

alter table public.subtarefas
  add column if not exists origem_subtarefa_id uuid;

create index if not exists subtarefas_origem_subtarefa_id_idx
  on public.subtarefas (origem_subtarefa_id)
  where origem_subtarefa_id is not null;

comment on column public.subtarefas.origem_subtarefa_id is
  'Subtarefa-template do modelo da série que originou esta cópia (uuid solto, sem FK).';

-- Backfill: liga por título as cópias criadas antes desta coluna existir
update public.subtarefas c
set origem_subtarefa_id = m.id
from public.tarefas o
join public.subtarefas m on m.tarefa_id = o.serie_raiz_id
where c.tarefa_id = o.id
  and c.origem_subtarefa_id is null
  and o.serie_raiz_id is not null
  and o.serie_raiz_id <> o.id
  and lower(trim(m.titulo)) = lower(trim(c.titulo));

-- -----------------------------------------------------------------------------
-- Clone das subtarefas do modelo: agora registra a origem
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

-- -----------------------------------------------------------------------------
-- Alinha as ocorrências abertas (hoje em diante) ao template do modelo
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
      if v_sub.data_inicio is not null then
        v_offset := public.recorrencia_offset_subtarefa(
          (v_sub.data_inicio at time zone v_tz)::date,
          v_ancora,
          v_config
        );
        if v_offset is not null then
          v_hora := coalesce(
            date_trunc('minute', (v_sub.data_inicio at time zone v_tz))::time,
            time '12:00'
          );
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
  'Alinha as subtarefas das ocorrências abertas (hoje em diante) ao template do modelo da série.';

-- -----------------------------------------------------------------------------
-- Gatilho: qualquer mudança no template do modelo reflete nas ocorrências
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_subtarefa_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarefa_id uuid;
begin
  -- Evita recursão: a sincronização escreve em subtarefas de ocorrências
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_tarefa_id := old.tarefa_id;
  else
    v_tarefa_id := new.tarefa_id;
  end if;

  if exists (
    select 1
    from public.tarefas t
    where t.id = v_tarefa_id
      and t.deleted_at is null
      and t.serie_raiz_id = t.id
      and t.recorrencia is not null
      and coalesce(t.recorrencia->>'tipo', 'nenhuma') <> 'nenhuma'
  ) then
    perform public.recorrencia_sincronizar_subtarefas(v_tarefa_id);
  end if;

  return null;
end;
$$;

drop trigger if exists subtarefas_recorrencia_sync on public.subtarefas;

create trigger subtarefas_recorrencia_sync
  after insert or update or delete on public.subtarefas
  for each row execute function public.recorrencia_subtarefa_sync_trigger();

-- -----------------------------------------------------------------------------
-- Job diário passa a sincronizar também (rede de segurança)
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

    perform public.recorrencia_sincronizar_subtarefas(v_modelo.id);
    perform public.recorrencia_atualizar_proxima_data(v_modelo.id);
  end loop;

  return v_criadas;
end;
$$;

revoke all on function public.recorrencia_sincronizar_subtarefas(uuid) from public;
revoke execute on function public.recorrencia_sincronizar_subtarefas(uuid) from anon;
grant execute on function public.recorrencia_sincronizar_subtarefas(uuid)
  to authenticated, service_role;

-- Alinha o que já está materializado hoje
select public.materializar_ocorrencias_recorrencia(0);
