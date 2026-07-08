insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-avatars', 'profile-avatars', true, 5242880)
on conflict (id) do nothing;

create policy "storage_profile_avatars_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin()
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
      public.is_admin()
      or auth.uid() = (storage.foldername(name))[1]::uuid
    )
  )
  with check (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin()
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
      public.is_admin()
      or auth.uid() = (storage.foldername(name))[1]::uuid
    )
  );
