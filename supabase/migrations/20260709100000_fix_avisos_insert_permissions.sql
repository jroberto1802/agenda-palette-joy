-- =============================================================================
-- Permite que qualquer usuário autenticado publique avisos
-- =============================================================================

drop policy if exists "avisos_insert" on public.avisos;

create policy "avisos_insert"
  on public.avisos
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and criado_por = auth.uid()
  );

drop policy if exists "aviso_setores_insert" on public.aviso_setores;

create policy "aviso_setores_insert"
  on public.aviso_setores
  for insert
  to authenticated
  with check (public.is_aviso_creator(aviso_id));

drop policy if exists "aviso_pessoas_insert" on public.aviso_pessoas;

create policy "aviso_pessoas_insert"
  on public.aviso_pessoas
  for insert
  to authenticated
  with check (public.is_aviso_creator(aviso_id));
