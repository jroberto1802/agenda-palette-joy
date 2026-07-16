-- =============================================================================
-- Visibilidade do menu Projetos
-- - Admin: vê todos os projetos
-- - Gestor / Usuário: só vê se for criador, responsável por alguma tarefa
--   do projeto, ou membro/visualizador (projeto_membros)
-- =============================================================================

create or replace function public.can_see_projeto(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.projetos p
        where p.id = p_projeto_id
          and p.criado_por = auth.uid()
      )
      or exists (
        select 1
        from public.projeto_membros pm
        where pm.projeto_id = p_projeto_id
          and pm.usuario_id = auth.uid()
      )
      or exists (
        select 1
        from public.tarefas t
        where t.projeto_id = p_projeto_id
          and t.deleted_at is null
          and (
            t.atribuido_a = auth.uid()
            or exists (
              select 1
              from public.tarefa_responsaveis r
              where r.tarefa_id = t.id
                and r.usuario_id = auth.uid()
            )
          )
      )
    );
$$;

comment on function public.can_see_projeto(uuid) is
  'Admin vê todos; demais só se criador, membro/visualizador ou responsável por tarefa do projeto.';

drop policy if exists "projetos_select" on public.projetos;

create policy "projetos_select"
  on public.projetos
  for select
  to authenticated
  using (public.can_see_projeto(id));
