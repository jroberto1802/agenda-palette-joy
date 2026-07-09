-- =============================================================================
-- Prioridade e data de expiração em avisos
-- =============================================================================

alter table public.avisos
  add column if not exists prioridade text not null default 'geral'
    check (prioridade in ('urgente', 'importante', 'informativo', 'geral'));

alter table public.avisos
  add column if not exists data_expiracao timestamptz;

update public.avisos
set data_expiracao = data_publicacao + interval '30 days'
where data_expiracao is null;

alter table public.avisos
  alter column data_expiracao set not null;

create index if not exists avisos_data_expiracao_idx on public.avisos (data_expiracao);

drop policy if exists "aviso_lido_por_delete_own" on public.aviso_lido_por;

create policy "aviso_lido_por_delete_own"
  on public.aviso_lido_por
  for delete
  to authenticated
  using (usuario_id = auth.uid());
