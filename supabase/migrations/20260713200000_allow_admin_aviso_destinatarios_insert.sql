-- =============================================================================
-- Permite que administradores gerenciem destinatários ao editar qualquer aviso
-- =============================================================================

drop policy if exists "aviso_setores_insert" on public.aviso_setores;

create policy "aviso_setores_insert"
  on public.aviso_setores
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_aviso_creator(aviso_id)
  );

drop policy if exists "aviso_pessoas_insert" on public.aviso_pessoas;

create policy "aviso_pessoas_insert"
  on public.aviso_pessoas
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_aviso_creator(aviso_id)
  );
