-- =============================================================================
-- Visualizadores (acesso somente leitura via Visibilidade) podem anexar arquivos.
-- Comentários já usam can_read_tarefa no insert; anexos/storage exigiam can_write.
-- Exclusão de anexos permanece no padrão anterior (escrita / criador / admin).
-- =============================================================================

-- tarefa_anexos: insert com leitura (alinha ao insert de comentários)
drop policy if exists "tarefa_anexos_insert" on public.tarefa_anexos;
create policy "tarefa_anexos_insert"
  on public.tarefa_anexos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_anexos.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

-- subtarefa_anexos: insert com leitura da tarefa pai
drop policy if exists "subtarefa_anexos_insert" on public.subtarefa_anexos;
create policy "subtarefa_anexos_insert"
  on public.subtarefa_anexos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where s.id = subtarefa_anexos.subtarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

-- Storage: upload com leitura (pasta raiz = tarefa_id)
drop policy if exists "storage_tarefa_anexos_insert" on storage.objects;
create policy "storage_tarefa_anexos_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tarefa-anexos'
    and public.can_read_tarefa((storage.foldername(name))[1]::uuid)
  );
