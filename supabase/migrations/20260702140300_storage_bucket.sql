-- =============================================================================
-- Fase 5: Storage bucket para anexos de tarefas
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('tarefa-anexos', 'tarefa-anexos', false, 10485760)
on conflict (id) do nothing;

-- Leitura: usuário com acesso à tarefa (pasta = tarefa_id)
create policy "storage_tarefa_anexos_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tarefa-anexos'
    and public.can_read_tarefa((storage.foldername(name))[1]::uuid)
  );

-- Upload: usuário com permissão de escrita na tarefa
create policy "storage_tarefa_anexos_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tarefa-anexos'
    and public.can_write_tarefa((storage.foldername(name))[1]::uuid)
  );

-- Exclusão: quem pode escrever na tarefa
create policy "storage_tarefa_anexos_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tarefa-anexos'
    and public.can_write_tarefa((storage.foldername(name))[1]::uuid)
  );
