-- =============================================================================
-- Edicao e reabertura de tarefas finalizadas.
--
-- Regras de negocio:
-- - Tarefa concluida: edicao de campos e sempre restrita ao Administrador,
--   em qualquer momento (mesmo dentro da janela de reabertura).
-- - Usuario comum e Gestor podem reabrir (concluida -> aberta) apenas dentro
--   de 20 minutos apos `data_conclusao`.
-- - Apos esse prazo, somente o Administrador pode reabrir ou editar.
--
-- Esta trigger e uma camada de defesa no banco (espelha a regra ja aplicada
-- no frontend em `src/utils/tarefas.ts`), evitando que a regra seja
-- contornada por chamadas diretas a API.
-- =============================================================================

create or replace function public.protect_tarefa_edicao_reabertura_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Regra só se aplica a uma tarefa que já estava concluída antes deste update.
  if old.concluida is distinct from true then
    return new;
  end if;

  -- Administrador pode editar e reabrir tarefas concluídas sem restrição.
  if public.is_admin() then
    return new;
  end if;

  -- Exclusão lógica (soft delete) é regida por outra trigger/RLS; não interfere aqui.
  if old.deleted_at is null and new.deleted_at is not null then
    return new;
  end if;

  -- Reabertura "pura" (somente concluida/data_conclusao mudam) dentro da janela de 20 minutos.
  if new.concluida = false
     and old.data_conclusao is not null
     and old.data_conclusao >= (now() - interval '20 minutes')
     and new.titulo is not distinct from old.titulo
     and new.descricao is not distinct from old.descricao
     and new.projeto_id is not distinct from old.projeto_id
     and new.setor_id is not distinct from old.setor_id
     and new.atribuido_a is not distinct from old.atribuido_a
     and new.prioridade is not distinct from old.prioridade
     and new.data_inicio is not distinct from old.data_inicio
     and new.tags is not distinct from old.tags
     and new.lembretes is not distinct from old.lembretes
     and new.recorrencia is not distinct from old.recorrencia
     and new.visibilidade is not distinct from old.visibilidade
  then
    return new;
  end if;

  raise exception
    'Tarefas concluídas só podem ser editadas ou reabertas por um Administrador. Usuário e Gestor podem reabrir apenas até 20 minutos após a conclusão.';
end;
$$;

drop trigger if exists tarefas_protect_edicao_reabertura_concluida on public.tarefas;

create trigger tarefas_protect_edicao_reabertura_concluida
  before update on public.tarefas
  for each row
  execute function public.protect_tarefa_edicao_reabertura_concluida();
