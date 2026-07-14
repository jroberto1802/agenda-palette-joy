-- =============================================================================
-- Detalhe expandido de subtarefa: campos de meta + anexos + comentários
-- =============================================================================

alter table public.subtarefas
  add column if not exists descricao text,
  add column if not exists projeto_id uuid references public.projetos (id) on delete set null,
  add column if not exists setor_id uuid references public.setores (id) on delete set null,
  add column if not exists data_inicio timestamptz,
  add column if not exists prioridade text not null default 'P4'
    check (prioridade in ('P1', 'P2', 'P3', 'P4')),
  add column if not exists status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'cancelada', 'concluida')),
  add column if not exists lembretes jsonb not null default '[]'::jsonb,
  add column if not exists recorrencia jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- Sincroniza status legacy com concluida
update public.subtarefas
set status = 'concluida'
where concluida = true and status <> 'concluida';

create index if not exists subtarefas_projeto_id_idx on public.subtarefas (projeto_id);
create index if not exists subtarefas_setor_id_idx on public.subtarefas (setor_id);
create index if not exists subtarefas_status_idx on public.subtarefas (status);

-- Observadores (visibilidade pessoas_especificas)
create table if not exists public.subtarefa_observadores (
  subtarefa_id uuid not null references public.subtarefas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subtarefa_id, usuario_id)
);

create index if not exists subtarefa_observadores_usuario_id_idx
  on public.subtarefa_observadores (usuario_id);

alter table public.subtarefa_observadores enable row level security;

create policy "subtarefa_observadores_select"
  on public.subtarefa_observadores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where s.id = subtarefa_observadores.subtarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_observadores_insert"
  on public.subtarefa_observadores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_observadores.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
  );

create policy "subtarefa_observadores_delete"
  on public.subtarefa_observadores
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_observadores.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
  );

-- Comentários próprios da subtarefa
create table if not exists public.subtarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  subtarefa_id uuid not null references public.subtarefas (id) on delete cascade,
  usuario_id uuid references public.profiles (id) on delete set null,
  conteudo text not null,
  parent_id uuid references public.subtarefa_comentarios (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists subtarefa_comentarios_subtarefa_id_idx
  on public.subtarefa_comentarios (subtarefa_id);

create index if not exists subtarefa_comentarios_parent_id_idx
  on public.subtarefa_comentarios (parent_id);

alter table public.subtarefa_comentarios enable row level security;

create policy "subtarefa_comentarios_select"
  on public.subtarefa_comentarios
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where s.id = subtarefa_comentarios.subtarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_comentarios_insert"
  on public.subtarefa_comentarios
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where s.id = subtarefa_comentarios.subtarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_comentarios_update"
  on public.subtarefa_comentarios
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "subtarefa_comentarios_delete"
  on public.subtarefa_comentarios
  for delete
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.is_admin()
    or public.is_gerente()
  );

-- Anexos próprios da subtarefa (storage path sob pasta da tarefa pai)
create table if not exists public.subtarefa_anexos (
  id uuid primary key default gen_random_uuid(),
  subtarefa_id uuid not null references public.subtarefas (id) on delete cascade,
  storage_path text not null,
  nome text not null,
  tipo text,
  tamanho bigint,
  created_at timestamptz not null default now()
);

create index if not exists subtarefa_anexos_subtarefa_id_idx
  on public.subtarefa_anexos (subtarefa_id);

alter table public.subtarefa_anexos enable row level security;

create policy "subtarefa_anexos_select"
  on public.subtarefa_anexos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where s.id = subtarefa_anexos.subtarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefa_anexos_insert"
  on public.subtarefa_anexos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_anexos.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
  );

create policy "subtarefa_anexos_delete"
  on public.subtarefa_anexos
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_anexos.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
  );

-- Profundidade de respostas (1 nível) também para subtarefa_comentarios
create or replace function public.enforce_comentario_reply_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if tg_table_name = 'tarefa_comentarios' then
    if exists (
      select 1 from public.tarefa_comentarios
      where id = new.parent_id and parent_id is not null
    ) then
      raise exception 'Apenas um nível de resposta é permitido';
    end if;
  elsif tg_table_name = 'aviso_comentarios' then
    if exists (
      select 1 from public.aviso_comentarios
      where id = new.parent_id and parent_id is not null
    ) then
      raise exception 'Apenas um nível de resposta é permitido';
    end if;
  elsif tg_table_name = 'subtarefa_comentarios' then
    if exists (
      select 1 from public.subtarefa_comentarios
      where id = new.parent_id and parent_id is not null
    ) then
      raise exception 'Apenas um nível de resposta é permitido';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists subtarefa_comentarios_reply_depth on public.subtarefa_comentarios;
create trigger subtarefa_comentarios_reply_depth
  before insert or update of parent_id on public.subtarefa_comentarios
  for each row execute function public.enforce_comentario_reply_depth();
