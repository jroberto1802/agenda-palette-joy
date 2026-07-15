-- =============================================================================
-- Simplifica tarefas e subtarefas para apenas dois estados: Aberta ou Concluída.
--
-- Remove o campo "status" (a_fazer / em_andamento / cancelada / concluida) de
-- `tarefas` e `subtarefas`, substituindo-o pelo booleano `concluida` (já
-- existente em subtarefas; criado agora em tarefas).
--
-- Regra de migração de dados: tarefas/subtarefas que estavam "cancelada"
-- passam a ser tratadas como "Concluída" (mesma regra de "Finalizados").
-- =============================================================================

alter table public.tarefas
  add column if not exists concluida boolean not null default false;

update public.tarefas
set concluida = true
where status in ('concluida', 'cancelada');

update public.tarefas
set data_conclusao = null
where concluida = false;

update public.subtarefas
set concluida = true
where status = 'cancelada';

drop index if exists public.tarefas_status_idx;
alter table public.tarefas
  drop constraint if exists tarefas_status_check;
alter table public.tarefas
  drop column if exists status;

drop index if exists public.subtarefas_status_idx;
alter table public.subtarefas
  drop constraint if exists subtarefas_status_check;
alter table public.subtarefas
  drop column if exists status;

create index if not exists tarefas_concluida_idx
  on public.tarefas (concluida)
  where deleted_at is null;

create index if not exists subtarefas_concluida_idx
  on public.subtarefas (concluida);

-- Atividades abertas do projeto agora usam `concluida = false`.
create or replace function public.projeto_has_open_activities(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.tarefas t
      where t.projeto_id = p_projeto_id
        and t.deleted_at is null
        and t.concluida = false
    )
    or exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where t.deleted_at is null
        and (t.projeto_id = p_projeto_id or s.projeto_id = p_projeto_id)
        and s.concluida = false
    );
$$;

-- Tarefa não pode ser excluída se houver subtarefas abertas.
create or replace function public.tarefa_has_open_subtarefas(p_tarefa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subtarefas s
    where s.tarefa_id = p_tarefa_id
      and s.concluida = false
  );
$$;

create or replace function public.protect_tarefa_delete_with_open_subtarefas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if public.tarefa_has_open_subtarefas(old.id) then
      raise exception
        'Não é possível excluir esta tarefa: existem subtarefas abertas. Conclua ou exclua as subtarefas antes de excluir a tarefa.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tarefas_protect_delete_with_open_subtarefas on public.tarefas;

create trigger tarefas_protect_delete_with_open_subtarefas
  before update on public.tarefas
  for each row
  execute function public.protect_tarefa_delete_with_open_subtarefas();

-- Tarefa não pode ser concluída se houver subtarefas abertas.
create or replace function public.protect_tarefa_conclusao_with_open_subtarefas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.concluida = false and new.concluida = true then
    if public.tarefa_has_open_subtarefas(old.id) then
      raise exception
        'Não é possível concluir esta tarefa: existem subtarefas abertas. Conclua-as primeiro.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tarefas_protect_conclusao_with_open_subtarefas on public.tarefas;

create trigger tarefas_protect_conclusao_with_open_subtarefas
  before update on public.tarefas
  for each row
  execute function public.protect_tarefa_conclusao_with_open_subtarefas();
