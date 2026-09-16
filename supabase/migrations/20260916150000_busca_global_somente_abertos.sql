-- =============================================================================
-- Busca global: apenas itens ativos (tarefas/subtarefas abertas)
-- Remove finalizadas dos resultados (revert de 20260915120000).
-- =============================================================================

create or replace function public.buscar_conteudo(p_termo text, p_limite integer default 20)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_termo text := trim(coalesce(p_termo, ''));
  v_pattern text;
  v_limite integer := greatest(1, least(coalesce(p_limite, 20), 50));
  v_projetos jsonb;
  v_tarefas jsonb;
  v_subtarefas jsonb;
  v_avisos jsonb;
  v_comentarios jsonb;
begin
  if char_length(v_termo) < 2 then
    return jsonb_build_object(
      'projetos', '[]'::jsonb,
      'tarefas', '[]'::jsonb,
      'subtarefas', '[]'::jsonb,
      'avisos', '[]'::jsonb,
      'comentarios', '[]'::jsonb
    );
  end if;

  v_pattern := '%' || public.escape_like_pattern(public.fold_search_text(v_termo)) || '%';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.nome), '[]'::jsonb)
  into v_projetos
  from (
    select p.id, p.nome
    from public.projetos p
    where public.fold_search_text(p.nome) like v_pattern escape '\'
    order by p.nome
    limit v_limite
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.titulo), '[]'::jsonb)
  into v_tarefas
  from (
    select
      t.id,
      t.titulo,
      left(coalesce(t.descricao, ''), 160) as trecho,
      t.concluida
    from public.tarefas t
    where t.deleted_at is null
      and t.concluida = false
      and (
        public.fold_search_text(t.titulo) like v_pattern escape '\'
        or public.fold_search_text(t.descricao) like v_pattern escape '\'
      )
    order by t.titulo
    limit v_limite
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.titulo), '[]'::jsonb)
  into v_subtarefas
  from (
    select
      s.id,
      s.titulo,
      s.tarefa_id,
      left(coalesce(s.descricao, ''), 160) as trecho,
      s.concluida
    from public.subtarefas s
    join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
    where s.concluida = false
      and t.concluida = false
      and (
        public.fold_search_text(s.titulo) like v_pattern escape '\'
        or public.fold_search_text(s.descricao) like v_pattern escape '\'
      )
    order by s.titulo
    limit v_limite
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.titulo), '[]'::jsonb)
  into v_avisos
  from (
    select a.id, a.titulo, left(coalesce(a.conteudo, ''), 160) as trecho
    from public.avisos a
    where
      public.fold_search_text(a.titulo) like v_pattern escape '\'
      or public.fold_search_text(a.conteudo) like v_pattern escape '\'
    order by a.titulo
    limit v_limite
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  into v_comentarios
  from (
    select *
    from (
      select
        c.id,
        'tarefa'::text as origem,
        c.tarefa_id,
        null::uuid as subtarefa_id,
        left(c.conteudo, 160) as trecho,
        t.titulo as contexto,
        c.created_at
      from public.tarefa_comentarios c
      join public.tarefas t on t.id = c.tarefa_id and t.deleted_at is null
      where t.concluida = false
        and public.fold_search_text(c.conteudo) like v_pattern escape '\'

      union all

      select
        c.id,
        'subtarefa'::text as origem,
        s.tarefa_id,
        c.subtarefa_id,
        left(c.conteudo, 160) as trecho,
        s.titulo as contexto,
        c.created_at
      from public.subtarefa_comentarios c
      join public.subtarefas s on s.id = c.subtarefa_id
      join public.tarefas t on t.id = s.tarefa_id and t.deleted_at is null
      where s.concluida = false
        and t.concluida = false
        and public.fold_search_text(c.conteudo) like v_pattern escape '\'
    ) x
    order by x.created_at desc
    limit v_limite
  ) r;

  return jsonb_build_object(
    'projetos', coalesce(v_projetos, '[]'::jsonb),
    'tarefas', coalesce(v_tarefas, '[]'::jsonb),
    'subtarefas', coalesce(v_subtarefas, '[]'::jsonb),
    'avisos', coalesce(v_avisos, '[]'::jsonb),
    'comentarios', coalesce(v_comentarios, '[]'::jsonb)
  );
end;
$$;

comment on function public.buscar_conteudo(text, integer) is
  'Busca global case/accent-insensitive em itens abertos; respeita RLS (security invoker). Finalizadas ficam no menu Finalizados.';
