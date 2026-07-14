-- =============================================================================
-- Autoria em subtarefas: criado_por e concluido_por
-- =============================================================================

alter table public.subtarefas
  add column if not exists criado_por uuid references public.profiles (id) on delete set null,
  add column if not exists concluido_por uuid references public.profiles (id) on delete set null;

create index if not exists subtarefas_criado_por_idx on public.subtarefas (criado_por);
create index if not exists subtarefas_concluido_por_idx on public.subtarefas (concluido_por);

-- Backfill: atribui criação ao criador da tarefa pai quando possível
update public.subtarefas s
set criado_por = t.criado_por
from public.tarefas t
where t.id = s.tarefa_id
  and s.criado_por is null
  and t.criado_por is not null;
