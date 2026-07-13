-- Expande subtarefas com metadados e responsáveis
alter table public.subtarefas
  add column if not exists descricao text,
  add column if not exists prioridade text,
  add column if not exists data_prazo timestamptz,
  add column if not exists criado_por uuid references public.profiles (id) on delete set null,
  add column if not exists concluido_por uuid references public.profiles (id) on delete set null,
  add column if not exists concluida_em timestamptz;

alter table public.subtarefas
  drop constraint if exists subtarefas_prioridade_check;

alter table public.subtarefas
  add constraint subtarefas_prioridade_check
  check (prioridade is null or prioridade in ('P1', 'P2', 'P3', 'P4'));

create table if not exists public.subtarefa_responsaveis (
  subtarefa_id uuid not null references public.subtarefas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  primary key (subtarefa_id, usuario_id)
);

create index if not exists subtarefa_responsaveis_usuario_id_idx
  on public.subtarefa_responsaveis (usuario_id);

alter table public.subtarefa_responsaveis enable row level security;

drop policy if exists "subtarefa_responsaveis_select" on public.subtarefa_responsaveis;
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

drop policy if exists "subtarefa_responsaveis_insert" on public.subtarefa_responsaveis;
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

drop policy if exists "subtarefa_responsaveis_delete" on public.subtarefa_responsaveis;
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
