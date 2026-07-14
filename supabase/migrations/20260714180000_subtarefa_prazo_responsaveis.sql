-- =============================================================================
-- Prazo, responsáveis e visibilidade em subtarefas
-- =============================================================================

alter table public.subtarefas
  add column if not exists data_vencimento timestamptz,
  add column if not exists visibilidade text
    check (
      visibilidade is null
      or visibilidade in (
        'todos_empresa',
        'todos_setor',
        'todos_projeto',
        'somente_para_mim',
        'pessoas_especificas'
      )
    );

create table if not exists public.subtarefa_responsaveis (
  subtarefa_id uuid not null references public.subtarefas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subtarefa_id, usuario_id)
);

create index if not exists subtarefa_responsaveis_usuario_id_idx
  on public.subtarefa_responsaveis (usuario_id);

alter table public.subtarefa_responsaveis enable row level security;

create policy "subtarefa_responsaveis_select"
  on public.subtarefa_responsaveis
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where s.id = subtarefa_responsaveis.subtarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_responsaveis_insert"
  on public.subtarefa_responsaveis
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_responsaveis.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
  );

create policy "subtarefa_responsaveis_delete"
  on public.subtarefa_responsaveis
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_responsaveis.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
  );
