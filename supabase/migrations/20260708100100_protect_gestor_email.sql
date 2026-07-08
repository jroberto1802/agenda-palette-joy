-- Impede usuário comum de alterar gestor_id e email no próprio perfil
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
    new.gestor_id := old.gestor_id;
    new.email := old.email;
  end if;

  return new;
end;
$$;
