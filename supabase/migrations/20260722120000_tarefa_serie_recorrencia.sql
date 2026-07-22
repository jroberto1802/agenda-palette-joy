-- =============================================================================
-- Recorrência por ocorrências independentes (série)
-- =============================================================================
-- serie_raiz_id:
--   NULL  → tarefa sem série
--   = id  → modelo (raiz) da série; guarda a regra em `recorrencia`
--   ≠ id → ocorrência materializada da série
-- =============================================================================

alter table public.tarefas
  add column if not exists serie_raiz_id uuid references public.tarefas (id) on delete set null;

create index if not exists tarefas_serie_raiz_id_idx
  on public.tarefas (serie_raiz_id)
  where deleted_at is null;

comment on column public.tarefas.serie_raiz_id is
  'Série de recorrência: NULL=sem série; igual a id=modelo; outro id=ocorrência.';
