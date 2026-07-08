-- =============================================================================
-- Agenda Interna Corporativa — schema inicial (Fase 2)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Funções utilitárias
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- setores (sem gerente_id inicialmente — dependência circular com profiles)
-- -----------------------------------------------------------------------------

create table public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger setores_updated_at
  before update on public.setores
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_completo text not null,
  avatar_url text,
  cargo text,
  setor_id uuid references public.setores (id) on delete set null,
  papel text not null default 'usuario'
    check (papel in ('admin', 'gerente', 'usuario', 'visualizador')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_setor_id_idx on public.profiles (setor_id);
create index profiles_papel_idx on public.profiles (papel) where ativo = true;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- FK circular: setores.gerente_id → profiles
alter table public.setores
  add column gerente_id uuid references public.profiles (id) on delete set null;

create index setores_gerente_id_idx on public.setores (gerente_id);

-- -----------------------------------------------------------------------------
-- Trigger: cria profile ao registrar usuário no Supabase Auth
-- Primeiro usuário do sistema vira admin automaticamente.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
  assigned_papel text;
  meta_papel text;
begin
  select count(*) = 0 into is_first_user from public.profiles;

  meta_papel := new.raw_user_meta_data->>'papel';

  if is_first_user then
    assigned_papel := 'admin';
  elsif meta_papel in ('admin', 'gerente', 'usuario', 'visualizador') then
    -- Signup público não pode auto-promover para admin/gerente
    assigned_papel := 'usuario';
  else
    assigned_papel := 'usuario';
  end if;

  insert into public.profiles (id, nome_completo, avatar_url, papel)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nome_completo'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    assigned_papel
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helpers de autorização (usadas nas policies RLS)
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and papel = 'admin'
      and ativo = true
  );
$$;

create or replace function public.is_gerente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and papel = 'gerente'
      and ativo = true
  );
$$;

create or replace function public.is_admin_or_gerente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and papel in ('admin', 'gerente')
      and ativo = true
  );
$$;

create or replace function public.my_setor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select setor_id from public.profiles where id = auth.uid();
$$;

create or replace function public.manages_setor(target_setor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_setor_id is not null
    and exists (
      select 1
      from public.profiles p
      left join public.setores s on s.id = target_setor_id
      where p.id = auth.uid()
        and p.ativo = true
        and (
          p.papel = 'admin'
          or (p.papel = 'gerente' and (s.gerente_id = auth.uid() or p.setor_id = target_setor_id))
        )
    );
$$;

create or replace function public.can_access_setor(target_setor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or target_setor_id is null
    or target_setor_id = public.my_setor_id()
    or public.manages_setor(target_setor_id);
$$;

-- Impede usuário comum de alterar campos sensíveis no próprio perfil
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.papel := old.papel;
    new.setor_id := old.setor_id;
    new.ativo := old.ativo;
  end if;

  return new;
end;
$$;

create trigger protect_profile_sensitive_fields
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_fields();

-- -----------------------------------------------------------------------------
-- tarefas e relacionamentos
-- -----------------------------------------------------------------------------

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  setor_id uuid references public.setores (id) on delete set null,
  criado_por uuid references public.profiles (id) on delete set null,
  atribuido_a uuid references public.profiles (id) on delete set null,
  prioridade text not null default 'P4'
    check (prioridade in ('P1', 'P2', 'P3', 'P4')),
  status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'bloqueada', 'concluida')),
  data_vencimento timestamptz,
  data_inicio timestamptz,
  data_conclusao timestamptz,
  tags text[] not null default '{}',
  recorrencia jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tarefas_setor_id_idx on public.tarefas (setor_id) where deleted_at is null;
create index tarefas_atribuido_a_idx on public.tarefas (atribuido_a) where deleted_at is null;
create index tarefas_status_idx on public.tarefas (status) where deleted_at is null;
create index tarefas_data_vencimento_idx on public.tarefas (data_vencimento) where deleted_at is null;
create index tarefas_criado_por_idx on public.tarefas (criado_por) where deleted_at is null;

create trigger tarefas_updated_at
  before update on public.tarefas
  for each row execute function public.set_updated_at();

create table public.subtarefas (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  titulo text not null,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

create index subtarefas_tarefa_id_idx on public.subtarefas (tarefa_id);

create table public.tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  usuario_id uuid references public.profiles (id) on delete set null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index tarefa_comentarios_tarefa_id_idx on public.tarefa_comentarios (tarefa_id);

create table public.tarefa_anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  storage_path text not null,
  nome text not null,
  tipo text,
  tamanho int,
  created_at timestamptz not null default now()
);

create index tarefa_anexos_tarefa_id_idx on public.tarefa_anexos (tarefa_id);

create table public.tarefa_observadores (
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  primary key (tarefa_id, usuario_id)
);

create table public.tarefa_historico (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  usuario_id uuid references public.profiles (id) on delete set null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz not null default now()
);

create index tarefa_historico_tarefa_id_idx on public.tarefa_historico (tarefa_id);

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
      and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.ativo = true
      )
      and (
        public.is_admin()
        or t.criado_por = auth.uid()
        or t.atribuido_a = auth.uid()
        or public.can_access_setor(t.setor_id)
        or exists (
          select 1
          from public.tarefa_observadores o
          where o.tarefa_id = t.id and o.usuario_id = auth.uid()
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
      and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.ativo = true
      )
      and (
        public.is_admin()
        or t.criado_por = auth.uid()
        or t.atribuido_a = auth.uid()
        or public.manages_setor(t.setor_id)
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- avisos e relacionamentos
-- -----------------------------------------------------------------------------

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text not null,
  criado_por uuid references public.profiles (id) on delete set null,
  data_publicacao timestamptz not null default now(),
  fixado boolean not null default false,
  alcance text not null
    check (alcance in ('todos', 'por_setor', 'pessoa_especifica')),
  comentarios_permitidos boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger avisos_updated_at
  before update on public.avisos
  for each row execute function public.set_updated_at();

create table public.aviso_setores (
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  setor_id uuid not null references public.setores (id) on delete cascade,
  primary key (aviso_id, setor_id)
);

create table public.aviso_pessoas (
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  primary key (aviso_id, usuario_id)
);

create table public.aviso_comentarios (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  usuario_id uuid references public.profiles (id) on delete set null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index aviso_comentarios_aviso_id_idx on public.aviso_comentarios (aviso_id);

create table public.aviso_lido_por (
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (aviso_id, usuario_id)
);

create or replace function public.can_read_aviso(target_aviso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.avisos a
    where a.id = target_aviso_id
      and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.ativo = true
      )
      and (
        public.is_admin_or_gerente()
        or a.alcance = 'todos'
        or (
          a.alcance = 'por_setor'
          and exists (
            select 1
            from public.aviso_setores s
            where s.aviso_id = a.id
              and s.setor_id = public.my_setor_id()
          )
        )
        or (
          a.alcance = 'pessoa_especifica'
          and exists (
            select 1
            from public.aviso_pessoas p
            where p.aviso_id = a.id
              and p.usuario_id = auth.uid()
          )
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- notificações
-- -----------------------------------------------------------------------------

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null,
  referencia_tipo text,
  referencia_id uuid,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notificacoes_usuario_id_idx on public.notificacoes (usuario_id, lida, created_at desc);
