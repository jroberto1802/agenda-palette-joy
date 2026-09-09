-- =============================================================================
-- Índices de Agenda: filtros por data_inicio em tarefas/subtarefas abertas
-- =============================================================================
-- A aba Hoje / Em breve / Atrasadas filtra por data_inicio + concluida=false.
-- O índice antigo em data_vencimento foi removido na unificação do prazo e
-- não havia sido recriado para data_inicio — listagens faziam Seq Scan.
-- =============================================================================

create index if not exists tarefas_agenda_data_inicio_idx
  on public.tarefas (data_inicio)
  where deleted_at is null
    and concluida = false
    and data_inicio is not null;

create index if not exists subtarefas_agenda_data_inicio_idx
  on public.subtarefas (data_inicio)
  where concluida = false
    and data_inicio is not null;

comment on index public.tarefas_agenda_data_inicio_idx is
  'Acelera listagens da Agenda (hoje / atrasadas / em breve) em tarefas abertas.';

comment on index public.subtarefas_agenda_data_inicio_idx is
  'Acelera listagens da Agenda em subtarefas abertas com data.';
