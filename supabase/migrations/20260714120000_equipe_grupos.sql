-- =============================================================================
-- Agrupamento manual da tela Equipe (independente de setores)
-- =============================================================================

create table public.equipe_grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipe_grupos_nome_not_blank check (length(trim(nome)) > 0)
);

create index equipe_grupos_ordem_idx on public.equipe_grupos (ordem, nome);

create trigger equipe_grupos_updated_at
  before update on public.equipe_grupos
  for each row execute function public.set_updated_at();

create table public.equipe_grupo_membros (
  grupo_id uuid not null references public.equipe_grupos (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grupo_id, usuario_id),
  constraint equipe_grupo_membros_usuario_unique unique (usuario_id)
);

create index equipe_grupo_membros_usuario_id_idx
  on public.equipe_grupo_membros (usuario_id);

alter table public.equipe_grupos enable row level security;
alter table public.equipe_grupo_membros enable row level security;

create policy "equipe_grupos_select"
  on public.equipe_grupos
  for select
  to authenticated
  using (true);

create policy "equipe_grupos_insert_admin_gerente"
  on public.equipe_grupos
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and public.is_admin_or_gerente()
  );

create policy "equipe_grupos_update_admin_gerente"
  on public.equipe_grupos
  for update
  to authenticated
  using (
    public.is_active_user()
    and public.is_admin_or_gerente()
  )
  with check (
    public.is_active_user()
    and public.is_admin_or_gerente()
  );

create policy "equipe_grupos_delete_admin_gerente"
  on public.equipe_grupos
  for delete
  to authenticated
  using (
    public.is_active_user()
    and public.is_admin_or_gerente()
  );

create policy "equipe_grupo_membros_select"
  on public.equipe_grupo_membros
  for select
  to authenticated
  using (true);

create policy "equipe_grupo_membros_insert_admin_gerente"
  on public.equipe_grupo_membros
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and public.is_admin_or_gerente()
  );

create policy "equipe_grupo_membros_update_admin_gerente"
  on public.equipe_grupo_membros
  for update
  to authenticated
  using (
    public.is_active_user()
    and public.is_admin_or_gerente()
  )
  with check (
    public.is_active_user()
    and public.is_admin_or_gerente()
  );

create policy "equipe_grupo_membros_delete_admin_gerente"
  on public.equipe_grupo_membros
  for delete
  to authenticated
  using (
    public.is_active_user()
    and public.is_admin_or_gerente()
  );
