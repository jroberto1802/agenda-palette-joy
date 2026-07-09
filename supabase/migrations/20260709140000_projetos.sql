-- =============================================================================
-- Módulo Projetos + vínculo com tarefas
-- =============================================================================

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  responsavel_id uuid references public.profiles (id) on delete set null,
  data_inicio timestamptz,
  data_termino_prevista timestamptz,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_andamento', 'concluido', 'cancelado')),
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projetos_nome_unique_idx on public.projetos (lower(trim(nome)));
create index projetos_responsavel_id_idx on public.projetos (responsavel_id);
create index projetos_status_idx on public.projetos (status);

create trigger projetos_updated_at
  before update on public.projetos
  for each row execute function public.set_updated_at();

alter table public.tarefas
  add column if not exists projeto_id uuid references public.projetos (id) on delete set null;

create index if not exists tarefas_projeto_id_idx
  on public.tarefas (projeto_id)
  where deleted_at is null;

alter table public.projetos enable row level security;

create policy "projetos_select"
  on public.projetos
  for select
  to authenticated
  using (true);

create policy "projetos_insert"
  on public.projetos
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and criado_por = auth.uid()
  );

create policy "projetos_update"
  on public.projetos
  for update
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

create policy "projetos_delete_admin_gerente"
  on public.projetos
  for delete
  to authenticated
  using (public.is_admin_or_gerente());

create or replace function public.protect_projeto_with_open_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  open_count int;
begin
  select count(*) into open_count
  from public.tarefas
  where projeto_id = old.id
    and deleted_at is null
    and status <> 'concluida';

  if open_count > 0 then
    raise exception
      'Não é possível excluir o projeto enquanto houver tarefas em aberto vinculadas a ele.';
  end if;

  return old;
end;
$$;

drop trigger if exists projetos_protect_with_open_tasks on public.projetos;

create trigger projetos_protect_with_open_tasks
  before delete on public.projetos
  for each row
  execute function public.protect_projeto_with_open_tasks();
