-- =============================================================================
-- Reações em comentários (um único tipo: check)
-- PK (comentario_id, usuario_id) = toggle: presença da linha = reagiu
-- =============================================================================

-- Tarefa
create table if not exists public.tarefa_comentario_reacoes (
  comentario_id uuid not null references public.tarefa_comentarios (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comentario_id, usuario_id)
);

create index if not exists tarefa_comentario_reacoes_usuario_id_idx
  on public.tarefa_comentario_reacoes (usuario_id);

alter table public.tarefa_comentario_reacoes enable row level security;

create policy "tarefa_comentario_reacoes_select"
  on public.tarefa_comentario_reacoes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tarefa_comentarios c
      join public.tarefas t on t.id = c.tarefa_id
      where c.id = tarefa_comentario_reacoes.comentario_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_comentario_reacoes_insert"
  on public.tarefa_comentario_reacoes
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.tarefa_comentarios c
      join public.tarefas t on t.id = c.tarefa_id
      where c.id = tarefa_comentario_reacoes.comentario_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_comentario_reacoes_delete"
  on public.tarefa_comentario_reacoes
  for delete
  to authenticated
  using (usuario_id = auth.uid());

-- Subtarefa
create table if not exists public.subtarefa_comentario_reacoes (
  comentario_id uuid not null references public.subtarefa_comentarios (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comentario_id, usuario_id)
);

create index if not exists subtarefa_comentario_reacoes_usuario_id_idx
  on public.subtarefa_comentario_reacoes (usuario_id);

alter table public.subtarefa_comentario_reacoes enable row level security;

create policy "subtarefa_comentario_reacoes_select"
  on public.subtarefa_comentario_reacoes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefa_comentarios c
      join public.subtarefas s on s.id = c.subtarefa_id
      join public.tarefas t on t.id = s.tarefa_id
      where c.id = subtarefa_comentario_reacoes.comentario_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_comentario_reacoes_insert"
  on public.subtarefa_comentario_reacoes
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.subtarefa_comentarios c
      join public.subtarefas s on s.id = c.subtarefa_id
      join public.tarefas t on t.id = s.tarefa_id
      where c.id = subtarefa_comentario_reacoes.comentario_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_comentario_reacoes_delete"
  on public.subtarefa_comentario_reacoes
  for delete
  to authenticated
  using (usuario_id = auth.uid());

-- Aviso
create table if not exists public.aviso_comentario_reacoes (
  comentario_id uuid not null references public.aviso_comentarios (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comentario_id, usuario_id)
);

create index if not exists aviso_comentario_reacoes_usuario_id_idx
  on public.aviso_comentario_reacoes (usuario_id);

alter table public.aviso_comentario_reacoes enable row level security;

create policy "aviso_comentario_reacoes_select"
  on public.aviso_comentario_reacoes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.aviso_comentarios c
      where c.id = aviso_comentario_reacoes.comentario_id
        and public.can_read_aviso(c.aviso_id)
    )
  );

create policy "aviso_comentario_reacoes_insert"
  on public.aviso_comentario_reacoes
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.aviso_comentarios c
      where c.id = aviso_comentario_reacoes.comentario_id
        and public.can_read_aviso(c.aviso_id)
        and exists (
          select 1 from public.avisos a
          where a.id = c.aviso_id
            and a.comentarios_permitidos = true
        )
    )
  );

create policy "aviso_comentario_reacoes_delete"
  on public.aviso_comentario_reacoes
  for delete
  to authenticated
  using (usuario_id = auth.uid());

comment on table public.tarefa_comentario_reacoes is
  'Reação única (check) em comentário de tarefa. Uma linha = um usuário reagiu.';
comment on table public.subtarefa_comentario_reacoes is
  'Reação única (check) em comentário de subtarefa.';
comment on table public.aviso_comentario_reacoes is
  'Reação única (check) em comentário de aviso.';
