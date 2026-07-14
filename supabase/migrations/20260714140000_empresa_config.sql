-- =============================================================================
-- Configuração global da empresa (nome + logo)
-- =============================================================================

create table public.empresa_config (
  id text primary key default 'default' check (id = 'default'),
  nome text not null default 'Unida Construtora',
  logo_url text,
  updated_at timestamptz not null default now(),
  updated_por uuid references public.profiles (id) on delete set null,
  constraint empresa_config_nome_not_blank check (length(trim(nome)) > 0)
);

create trigger empresa_config_updated_at
  before update on public.empresa_config
  for each row execute function public.set_updated_at();

insert into public.empresa_config (id, nome)
values ('default', 'Unida Construtora');

alter table public.empresa_config enable row level security;

create policy "empresa_config_select"
  on public.empresa_config
  for select
  to authenticated
  using (true);

create policy "empresa_config_update_admin"
  on public.empresa_config
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Storage: logos públicas (leitura via URL pública); escrita só Admin
insert into storage.buckets (id, name, public, file_size_limit)
values ('empresa-logos', 'empresa-logos', true, 5242880)
on conflict (id) do nothing;

create policy "storage_empresa_logos_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'empresa-logos');

create policy "storage_empresa_logos_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'empresa-logos'
    and public.is_admin()
  );

create policy "storage_empresa_logos_update_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'empresa-logos'
    and public.is_admin()
  )
  with check (
    bucket_id = 'empresa-logos'
    and public.is_admin()
  );

create policy "storage_empresa_logos_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'empresa-logos'
    and public.is_admin()
  );
