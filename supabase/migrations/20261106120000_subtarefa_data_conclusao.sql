-- =============================================================================
-- Data de conclusão da subtarefa
--
-- Tarefas já guardam `data_conclusao`; subtarefas só tinham `concluida` e
-- `concluido_por`. A aba Em breve passa a listar, em cada dia, as atividades
-- concluídas naquele dia (Tarefas e Subtarefas), então a subtarefa precisa do
-- instante exato da conclusão.
--
-- Mantida por trigger (e não pelo cliente) para valer em qualquer caminho que
-- conclua/reabra a subtarefa, inclusive funções do banco.
-- =============================================================================

alter table public.subtarefas
  add column if not exists data_conclusao timestamptz;

-- Histórico: melhor aproximação disponível é a última atualização da linha.
update public.subtarefas
set data_conclusao = coalesce(updated_at, created_at)
where concluida = true
  and data_conclusao is null;

create index if not exists subtarefas_data_conclusao_idx
  on public.subtarefas (data_conclusao)
  where concluida = true;

create or replace function public.subtarefa_sync_data_conclusao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.concluida then
      new.data_conclusao := coalesce(new.data_conclusao, now());
    else
      new.data_conclusao := null;
    end if;
    return new;
  end if;

  if new.concluida and not old.concluida then
    -- Acabou de ser concluída.
    new.data_conclusao := now();
  elsif not new.concluida then
    -- Reaberta (ou nunca concluída): sem data de conclusão.
    new.data_conclusao := null;
  else
    -- Continua concluída: edições não alteram a data em que foi concluída.
    new.data_conclusao := coalesce(old.data_conclusao, new.data_conclusao, now());
  end if;

  return new;
end;
$$;

drop trigger if exists subtarefas_sync_data_conclusao on public.subtarefas;
create trigger subtarefas_sync_data_conclusao
  before insert or update on public.subtarefas
  for each row
  execute function public.subtarefa_sync_data_conclusao();
