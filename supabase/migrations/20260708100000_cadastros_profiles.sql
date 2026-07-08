-- Cadastros: email + gestor responsável em profiles; proteção do último admin;
-- e-mail único; bloqueio de exclusão de setor com pessoas vinculadas.

-- ---------------------------------------------------------------------------
-- Colunas novas em profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists gestor_id uuid references public.profiles (id) on delete set null;

create index if not exists profiles_gestor_id_idx on public.profiles (gestor_id);

-- Backfill email a partir do Auth
update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id
  and u.email is not null
  and (p.email is null or p.email = '');

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

-- Garante email no insert do trigger de signup
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
    assigned_papel := 'usuario';
  else
    assigned_papel := 'usuario';
  end if;

  insert into public.profiles (id, nome_completo, avatar_url, papel, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nome_completo'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    assigned_papel,
    lower(new.email)
  );

  return new;
end;
$$;

-- Sync email on auth.users email changes
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = lower(new.email)
  where id = new.id
    and new.email is not null
    and (email is distinct from lower(new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
  after insert or update of email on auth.users
  for each row
  execute function public.sync_profile_email_from_auth();

-- ---------------------------------------------------------------------------
-- Impede excluir/inativar o último Administrador ativo
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_admins int;
begin
  if tg_op = 'DELETE' then
    if old.papel = 'admin' and old.ativo = true then
      select count(*) into active_admins
      from public.profiles
      where papel = 'admin' and ativo = true and id <> old.id;
      if active_admins = 0 then
        raise exception 'Não é possível excluir o último Administrador do sistema.';
      end if;
    end if;
    return old;
  end if;

  if old.papel = 'admin' and old.ativo = true then
    if (new.ativo = false) or (new.papel is distinct from 'admin') then
      select count(*) into active_admins
      from public.profiles
      where papel = 'admin' and ativo = true and id <> old.id;
      if active_admins = 0 then
        raise exception 'Não é possível inativar ou rebaixar o último Administrador do sistema.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_last_admin on public.profiles;
create trigger profiles_protect_last_admin
  before update or delete on public.profiles
  for each row
  execute function public.protect_last_admin();

-- ---------------------------------------------------------------------------
-- Bloqueia exclusão de setor com pessoas vinculadas
-- ---------------------------------------------------------------------------
create or replace function public.protect_setor_with_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked int;
begin
  select count(*) into linked
  from public.profiles
  where setor_id = old.id;

  if linked > 0 then
    raise exception
      'Não é possível excluir o setor enquanto houver pessoas vinculadas. Realoque as pessoas antes de excluir.';
  end if;

  return old;
end;
$$;

drop trigger if exists setores_protect_with_people on public.setores;
create trigger setores_protect_with_people
  before delete on public.setores
  for each row
  execute function public.protect_setor_with_people();
