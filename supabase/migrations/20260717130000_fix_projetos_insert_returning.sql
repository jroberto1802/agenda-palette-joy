-- =============================================================================
-- Corrige 403 ao criar projeto (gestor/usuario)
--
-- Causa: INSERT ... RETURNING aplica a policy SELECT. can_see_projeto() fazia
-- EXISTS em public.projetos e, no meio do INSERT, a linha nova não era vista.
-- Admin passava via is_admin(); criador comum recebia 403.
--
-- Correção: policy SELECT usa criado_por da própria linha (sem subquery).
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

drop policy if exists "projetos_select" on public.projetos;

-- Avaliação direta na linha: funciona no INSERT ... RETURNING
create policy "projetos_select"
  on public.projetos
  for select
  to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or criado_por = auth.uid()
      or exists (
        select 1
        from public.projeto_membros pm
        where pm.projeto_id = projetos.id
          and pm.usuario_id = auth.uid()
      )
    )
  );

drop policy if exists "projetos_insert" on public.projetos;

create policy "projetos_insert"
  on public.projetos
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and criado_por = auth.uid()
  );

grant select, insert, update, delete on table public.projetos to authenticated;
