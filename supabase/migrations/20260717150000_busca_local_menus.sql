-- =============================================================================
-- Busca local (Agenda, Projetos, Finalizados)
-- - Mesma lógica da busca global: fold_search_text + comentários
-- - SECURITY INVOKER: respeita RLS de cada tabela
-- =============================================================================

create or replace function public.buscar_tarefa_ids(p_termo text)
returns uuid[]
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_termo text := trim(coalesce(p_termo, ''));
  v_pattern text;
  v_ids uuid[];
begin
  if char_length(v_termo) < 2 then
    return array[]::uuid[];
  end if;

  v_pattern := '%' || public.escape_like_pattern(public.fold_search_text(v_termo)) || '%';

  select coalesce(array_agg(distinct x.id), array[]::uuid[])
  into v_ids
  from (
    select t.id
    from public.tarefas t
    where t.deleted_at is null
      and (
        public.fold_search_text(t.titulo) like v_pattern escape '\'
        or public.fold_search_text(t.descricao) like v_pattern escape '\'
      )

    union

    select s.tarefa_id as id
    from public.subtarefas s
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where
      public.fold_search_text(s.titulo) like v_pattern escape '\'
      or public.fold_search_text(s.descricao) like v_pattern escape '\'

    union

    select c.tarefa_id as id
    from public.tarefa_comentarios c
    join public.tarefas t on t.id = c.tarefa_id and t.deleted_at is null
    where public.fold_search_text(c.conteudo) like v_pattern escape '\'

    union

    select s.tarefa_id as id
    from public.subtarefa_comentarios c
    join public.subtarefas s on s.id = c.subtarefa_id
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where public.fold_search_text(c.conteudo) like v_pattern escape '\'
  ) x;

  return coalesce(v_ids, array[]::uuid[]);
end;
$$;

comment on function public.buscar_tarefa_ids(text) is
  'IDs de tarefas que batem no termo (título/descrição/comentários de tarefa e subtarefa); case/accent-insensitive; respeita RLS.';

create or replace function public.buscar_projeto_ids(p_termo text)
returns uuid[]
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_termo text := trim(coalesce(p_termo, ''));
  v_pattern text;
  v_ids uuid[];
begin
  if char_length(v_termo) < 2 then
    return array[]::uuid[];
  end if;

  v_pattern := '%' || public.escape_like_pattern(public.fold_search_text(v_termo)) || '%';

  select coalesce(array_agg(distinct x.id), array[]::uuid[])
  into v_ids
  from (
    select p.id
    from public.projetos p
    where public.fold_search_text(p.nome) like v_pattern escape '\'

    union

    select t.projeto_id as id
    from public.tarefas t
    where t.deleted_at is null
      and t.projeto_id is not null
      and (
        public.fold_search_text(t.titulo) like v_pattern escape '\'
        or public.fold_search_text(t.descricao) like v_pattern escape '\'
      )

    union

    select t.projeto_id as id
    from public.subtarefas s
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where t.projeto_id is not null
      and (
        public.fold_search_text(s.titulo) like v_pattern escape '\'
        or public.fold_search_text(s.descricao) like v_pattern escape '\'
      )

    union

    select t.projeto_id as id
    from public.tarefa_comentarios c
    join public.tarefas t on t.id = c.tarefa_id and t.deleted_at is null
    where t.projeto_id is not null
      and public.fold_search_text(c.conteudo) like v_pattern escape '\'

    union

    select t.projeto_id as id
    from public.subtarefa_comentarios c
    join public.subtarefas s on s.id = c.subtarefa_id
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where t.projeto_id is not null
      and public.fold_search_text(c.conteudo) like v_pattern escape '\'
  ) x;

  return coalesce(v_ids, array[]::uuid[]);
end;
$$;

comment on function public.buscar_projeto_ids(text) is
  'IDs de projetos que batem no termo (nome ou conteúdo interno de tarefas/subtarefas/comentários); case/accent-insensitive; respeita RLS.';

grant execute on function public.buscar_tarefa_ids(text) to authenticated;
grant execute on function public.buscar_projeto_ids(text) to authenticated;
