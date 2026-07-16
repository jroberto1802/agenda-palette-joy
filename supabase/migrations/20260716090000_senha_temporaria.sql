-- =============================================================================
-- Senha temporária em profiles (Restaurar Senha).
--
-- Após restaurar a senha, a conta fica marcada com senha_temporaria = true e
-- prazo de 3 dias (senha_temporaria_expira_em) para o usuário definir uma
-- senha definitiva. Enquanto a flag estiver ativa, o acesso ao sistema exige
-- a definição da nova senha.
-- =============================================================================

alter table public.profiles
  add column if not exists senha_temporaria boolean not null default false;

alter table public.profiles
  add column if not exists senha_temporaria_expira_em timestamptz;

comment on column public.profiles.senha_temporaria is
  'Indica que a senha atual é temporária e deve ser trocada pelo usuário.';

comment on column public.profiles.senha_temporaria_expira_em is
  'Prazo (3 dias após o reset) para definir nova senha. Após o prazo, o acesso permanece bloqueado até a troca.';
