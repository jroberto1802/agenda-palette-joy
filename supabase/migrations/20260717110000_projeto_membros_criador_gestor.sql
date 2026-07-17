-- =============================================================================
-- Gestão de membros e exclusão de projetos (atualização)
-- Membros:
--   - Criador: sempre
--   - Admin: qualquer projeto
--   - Gestor: apenas se participar (criador ou membro)
-- Exclusão sem abertas: criador, gestor participante ou admin
-- Exclusão com abertas: somente admin
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
  'Criador sempre; admin em qualquer projeto; gestor só se participar; usuário não criador não gerencia.';

create or replace function public.can_delete_projeto(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projetos p
    where p.id = p_projeto_id
      and public.is_active_user()
      and (
        public.is_admin()
        or (
          not public.projeto_has_open_activities(p.id)
          and (
            p.criado_por = auth.uid()
            or (
              public.is_gerente()
              and (
                p.criado_por = auth.uid()
                or exists (
                  select 1
                  from public.projeto_membros pm
                  where pm.projeto_id = p.id
                    and pm.usuario_id = auth.uid()
                )
              )
            )
          )
        )
      )
  );
$$;

comment on function public.can_delete_projeto(uuid) is
  'Com abertas: só admin. Sem abertas: criador, gestor participante ou admin.';
