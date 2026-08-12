-- Permite que qualquer autenticado leia perfis desativados (nome/avatar)
-- para exibição em histórico (comentários, autoria, reações, etc.).
-- Novas atribuições continuam filtradas na UI via profiles.ativo = true.

drop policy if exists "profiles_select_active" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

comment on policy "profiles_select_authenticated" on public.profiles is
  'Leitura de perfis (ativos e desativados) para embeds e histórico; atribuições filtradas na aplicação.';
