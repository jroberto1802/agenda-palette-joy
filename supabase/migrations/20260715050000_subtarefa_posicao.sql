-- =============================================================================
-- Ordem drag-and-drop das subtarefas dentro da tarefa
-- =============================================================================

alter table public.subtarefas
  add column if not exists posicao integer not null default 0;

create index if not exists subtarefas_tarefa_posicao_idx
  on public.subtarefas (tarefa_id, posicao);

-- Backfill: mantém ordem de criação
with ranked as (
  select
    id,
    row_number() over (
      partition by tarefa_id
      order by created_at asc, id asc
    ) - 1 as rn
  from public.subtarefas
)
update public.subtarefas s
set posicao = ranked.rn
from ranked
where s.id = ranked.id;
