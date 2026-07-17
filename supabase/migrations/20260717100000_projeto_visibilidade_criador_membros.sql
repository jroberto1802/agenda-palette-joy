-- =============================================================================
-- Visibilidade de projetos (atualização)
-- - Admin: vê todos
-- - Demais (inclui Gestor): só se for criador OU membro adicionado manualmente
-- - Responsável por tarefa NÃO concede mais visibilidade do projeto
-- - Adicionar/remover membros: somente admin e gestor
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
    );
$$;

comment on function public.can_see_projeto(uuid) is
  'Admin vê todos; demais só se criador ou membro adicionado manualmente ao projeto.';

create or replace function public.can_manage_projeto_membros(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and public.is_admin_or_gerente();
$$;

comment on function public.can_manage_projeto_membros(uuid) is
  'Somente administrador e gestor podem adicionar/remover participantes do projeto.';
