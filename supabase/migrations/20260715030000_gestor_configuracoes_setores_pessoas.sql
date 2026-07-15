-- =============================================================================
-- Gestor pode criar/gerenciar Setores e Pessoas (Configurações restritas)
-- =============================================================================

-- Setores: insert/update/delete para admin ou gestor
drop policy if exists "setores_insert_admin" on public.setores;
drop policy if exists "setores_insert_admin_or_gerente" on public.setores;

create policy "setores_insert_admin_or_gerente"
  on public.setores
  for insert
  to authenticated
  with check (public.is_admin_or_gerente());

drop policy if exists "setores_update_admin_or_gerente" on public.setores;

create policy "setores_update_admin_or_gerente"
  on public.setores
  for update
  to authenticated
  using (public.is_admin_or_gerente())
  with check (public.is_admin_or_gerente());

drop policy if exists "setores_delete_admin" on public.setores;
drop policy if exists "setores_delete_admin_or_gerente" on public.setores;

create policy "setores_delete_admin_or_gerente"
  on public.setores
  for delete
  to authenticated
  using (public.is_admin_or_gerente());

-- Profiles: gestor pode atualizar pessoas (exceto admins)
drop policy if exists "profiles_update_gerente_cadastros" on public.profiles;

create policy "profiles_update_gerente_cadastros"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_gerente()
    and papel <> 'admin'
  )
  with check (
    public.is_gerente()
    and papel <> 'admin'
  );

-- Avatares: gestor pode enviar foto ao cadastrar/editar pessoas
drop policy if exists "storage_profile_avatars_insert" on storage.objects;
drop policy if exists "storage_profile_avatars_update" on storage.objects;
drop policy if exists "storage_profile_avatars_delete" on storage.objects;

create policy "storage_profile_avatars_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin_or_gerente()
      or auth.uid() = (storage.foldername(name))[1]::uuid
    )
  );

create policy "storage_profile_avatars_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin_or_gerente()
      or auth.uid() = (storage.foldername(name))[1]::uuid
    )
  )
  with check (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin_or_gerente()
      or auth.uid() = (storage.foldername(name))[1]::uuid
    )
  );

create policy "storage_profile_avatars_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin_or_gerente()
      or auth.uid() = (storage.foldername(name))[1]::uuid
    )
  );
