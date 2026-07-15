-- =============================================================================
-- Colunas pessoais do quadro de tarefas + ordenação pessoal (lista/cards)
-- =============================================================================

create table public.tarefa_board_colunas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  nome text not null,
  posicao integer not null default 0,
  is_inbox boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tarefa_board_colunas_nome_not_blank check (length(trim(nome)) > 0)
);

create unique index tarefa_board_colunas_one_inbox_per_user_idx
  on public.tarefa_board_colunas (usuario_id)
  where is_inbox = true;

create index tarefa_board_colunas_usuario_pos_idx
  on public.tarefa_board_colunas (usuario_id, posicao);

create trigger tarefa_board_colunas_updated_at
  before update on public.tarefa_board_colunas
  for each row execute function public.set_updated_at();

create table public.tarefa_board_itens (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  coluna_id uuid not null references public.tarefa_board_colunas (id) on delete restrict,
  posicao_coluna integer not null default 0,
  posicao_lista integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (usuario_id, tarefa_id)
);

create index tarefa_board_itens_coluna_pos_idx
  on public.tarefa_board_itens (usuario_id, coluna_id, posicao_coluna);

create index tarefa_board_itens_lista_pos_idx
  on public.tarefa_board_itens (usuario_id, posicao_lista);

create trigger tarefa_board_itens_updated_at
  before update on public.tarefa_board_itens
  for each row execute function public.set_updated_at();

alter table public.tarefa_board_colunas enable row level security;
alter table public.tarefa_board_itens enable row level security;

create policy "tarefa_board_colunas_select_own"
  on public.tarefa_board_colunas
  for select
  to authenticated
  using (usuario_id = auth.uid() and public.is_active_user());

create policy "tarefa_board_colunas_insert_own"
  on public.tarefa_board_colunas
  for insert
  to authenticated
  with check (usuario_id = auth.uid() and public.is_active_user());

create policy "tarefa_board_colunas_update_own"
  on public.tarefa_board_colunas
  for update
  to authenticated
  using (usuario_id = auth.uid() and public.is_active_user())
  with check (usuario_id = auth.uid() and public.is_active_user());

create policy "tarefa_board_colunas_delete_own"
  on public.tarefa_board_colunas
  for delete
  to authenticated
  using (
    usuario_id = auth.uid()
    and public.is_active_user()
    and is_inbox = false
  );

create policy "tarefa_board_itens_select_own"
  on public.tarefa_board_itens
  for select
  to authenticated
  using (usuario_id = auth.uid() and public.is_active_user());

create policy "tarefa_board_itens_insert_own"
  on public.tarefa_board_itens
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.tarefa_board_colunas c
      where c.id = coluna_id and c.usuario_id = auth.uid()
    )
  );

create policy "tarefa_board_itens_update_own"
  on public.tarefa_board_itens
  for update
  to authenticated
  using (usuario_id = auth.uid() and public.is_active_user())
  with check (
    usuario_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.tarefa_board_colunas c
      where c.id = coluna_id and c.usuario_id = auth.uid()
    )
  );

create policy "tarefa_board_itens_delete_own"
  on public.tarefa_board_itens
  for delete
  to authenticated
  using (usuario_id = auth.uid() and public.is_active_user());
