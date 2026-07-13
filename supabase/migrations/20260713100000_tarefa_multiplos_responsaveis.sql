-- =============================================================================
-- Múltiplos responsáveis por tarefa + equipe de projeto (para filtro de seleção)
-- =============================================================================

-- Equipe do projeto (base para restringir responsáveis elegíveis)
create table if not exists public.projeto_membros (
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  primary key (projeto_id, usuario_id)
);

create index if not exists projeto_membros_usuario_id_idx
  on public.projeto_membros (usuario_id);

alter table public.projeto_membros enable row level security;

create policy "projeto_membros_select"
  on public.projeto_membros
  for select
  to authenticated
  using (true);

create policy "projeto_membros_manage"
  on public.projeto_membros
  for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

-- Semeia membros a partir do responsável atual do projeto
insert into public.projeto_membros (projeto_id, usuario_id)
select id, responsavel_id
from public.projetos
where responsavel_id is not null
on conflict do nothing;

-- Junction de responsáveis da tarefa
create table if not exists public.tarefa_responsaveis (
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  primary key (tarefa_id, usuario_id)
);

create index if not exists tarefa_responsaveis_usuario_id_idx
  on public.tarefa_responsaveis (usuario_id);

alter table public.tarefa_responsaveis enable row level security;

create policy "tarefa_responsaveis_select"
  on public.tarefa_responsaveis
  for select
  to authenticated
  using (public.can_read_tarefa(tarefa_id));

create policy "tarefa_responsaveis_insert"
  on public.tarefa_responsaveis
  for insert
  to authenticated
  with check (
    public.can_write_tarefa(tarefa_id)
    or exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_id
        and t.criado_por = auth.uid()
        and t.deleted_at is null
    )
  );

create policy "tarefa_responsaveis_delete"
  on public.tarefa_responsaveis
  for delete
  to authenticated
  using (
    public.can_write_tarefa(tarefa_id)
    or exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_id
        and t.criado_por = auth.uid()
        and t.deleted_at is null
    )
  );

-- Migra responsável único legado
insert into public.tarefa_responsaveis (tarefa_id, usuario_id)
select id, atribuido_a
from public.tarefas
where atribuido_a is not null
  and deleted_at is null
on conflict do nothing;

-- RLS: leitura/escrita consideram qualquer responsável
create or replace function public.can_read_tarefa(tarefa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tarefas t
    where t.id = tarefa_id
      and t.deleted_at is null
      and public.is_active_user()
      and (
        public.is_admin()
        or t.criado_por = auth.uid()
        or t.atribuido_a = auth.uid()
        or exists (
          select 1
          from public.tarefa_responsaveis r
          where r.tarefa_id = t.id
            and r.usuario_id = auth.uid()
        )
        or t.visibilidade = 'todos_empresa'
        or (
          t.visibilidade = 'todos_setor'
          and t.setor_id is not null
          and (
            t.setor_id = public.my_setor_id()
            or public.manages_setor(t.setor_id)
          )
        )
        or (
          t.visibilidade = 'somente_para_mim'
          and public.manages_setor(t.setor_id)
        )
        or (
          t.visibilidade = 'pessoas_especificas'
          and exists (
            select 1
            from public.tarefa_observadores o
            where o.tarefa_id = t.id and o.usuario_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.can_write_tarefa(tarefa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tarefas t
    where t.id = tarefa_id
      and t.deleted_at is null
      and public.is_active_user()
      and (
        public.is_admin()
        or t.criado_por = auth.uid()
        or t.atribuido_a = auth.uid()
        or exists (
          select 1
          from public.tarefa_responsaveis r
          where r.tarefa_id = t.id
            and r.usuario_id = auth.uid()
        )
        or public.manages_setor(t.setor_id)
      )
  );
$$;
