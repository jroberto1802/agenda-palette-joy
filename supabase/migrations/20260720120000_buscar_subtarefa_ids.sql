-- =============================================================================
-- Busca local de subtarefas (título/descrição/comentários)
-- Mesma lógica fold_search_text; SECURITY INVOKER (RLS)
-- =============================================================================

create or replace function public.buscar_subtarefa_ids(p_termo text)
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
    select s.id
    from public.subtarefas s
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where
      public.fold_search_text(s.titulo) like v_pattern escape '\'
      or public.fold_search_text(s.descricao) like v_pattern escape '\'

    union

    select c.subtarefa_id as id
    from public.subtarefa_comentarios c
    join public.subtarefas s on s.id = c.subtarefa_id
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where public.fold_search_text(c.conteudo) like v_pattern escape '\'
  ) x;

  return coalesce(v_ids, array[]::uuid[]);
end;
$$;

comment on function public.buscar_subtarefa_ids(text) is
  'IDs de subtarefas que batem no termo (título/descrição/comentários); case/accent-insensitive; respeita RLS.';

grant execute on function public.buscar_subtarefa_ids(text) to authenticated;
