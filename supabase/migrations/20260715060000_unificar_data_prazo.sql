-- =============================================================================
-- Unifica os campos "Data" (data_inicio) e "Prazo" (data_vencimento) em um
-- único campo de data por tarefa/subtarefa. Elimina a duplicidade mantendo
-- somente `data_inicio`, exibido na interface como "Data".
--
-- Regra de conflito: quando os dois campos estão preenchidos com valores
-- diferentes, prevalece o valor já existente em `data_inicio`. Quando
-- `data_inicio` está vazia e `data_vencimento` está preenchida, o valor de
-- `data_vencimento` é herdado para não perder informação já registrada.
-- =============================================================================

update public.tarefas
set data_inicio = data_vencimento
where data_inicio is null
  and data_vencimento is not null;

update public.subtarefas
set data_inicio = data_vencimento
where data_inicio is null
  and data_vencimento is not null;

drop index if exists public.tarefas_data_vencimento_idx;

alter table public.tarefas
  drop column if exists data_vencimento;

alter table public.subtarefas
  drop column if exists data_vencimento;
