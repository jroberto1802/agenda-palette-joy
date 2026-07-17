-- =============================================================================
-- Garante criação de projeto por qualquer perfil ativo + gestão de membros
-- pelo criador (corrige falha do perfil Usuário ao criar com equipe).
-- =============================================================================

create or replace function public.can_manage_projeto_membros(p_projeto_id uuid)
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
      or (
        public.is_gerente()
        and exists (
          select 1
          from public.projeto_membros pm
          where pm.projeto_id = p_projeto_id
            and pm.usuario_id = auth.uid()
        )
      )
    );
$$;

comment on function public.can_manage_projeto_membros(uuid) is
  'Criador sempre; admin em qualquer projeto; gestor só se participar.';

-- Reforça insert de projetos: qualquer usuário ativo pode criar (como criador).
drop policy if exists "projetos_insert" on public.projetos;

create policy "projetos_insert"
  on public.projetos
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and criado_por = auth.uid()
  );
