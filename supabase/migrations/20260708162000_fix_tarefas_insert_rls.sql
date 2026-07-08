-- =============================================================================
-- Corrige criação de tarefas sem depender de profile ativo no WITH CHECK
-- =============================================================================

drop policy if exists "tarefas_insert" on public.tarefas;

create policy "tarefas_insert"
  on public.tarefas
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and criado_por = auth.uid()
  );
