-- =============================================================================
-- Permissões ampliadas de Responsável / Visualizador (Tarefa e Subtarefa)
--
-- Quem é Responsável ou Visualizador (mesmo sem ser criador e com perfil
-- Usuário) passa a poder:
--   * adicionar pessoas como Responsáveis ou Visualizadores;
--   * concluir a Tarefa/Subtarefa;
--   * alterar Data e Hora;
--   * comentar e anexar (já liberado por `can_read_tarefa`).
--
-- Continua restrito a Criador, Gestor (do setor) e Administrador:
--   * remover Responsáveis/Visualizadores (regra aplicada na interface);
--   * editar Título e Descrição (agora também protegido por trigger).
--
-- Visualizador (sem ser Responsável) NÃO ganha: Projeto, Setor, Prioridade,
-- Tags, Lembretes, exclusão, nem criação de subtarefas — protegido por trigger
-- porque RLS não restringe colunas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Usuário logado é Visualizador (observador) da tarefa.
create or replace function public.is_tarefa_observador(p_tarefa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tarefas t
    where t.id = p_tarefa_id
      and t.deleted_at is null
      and public.is_active_user()
      and exists (
        select 1
        from public.tarefa_observadores o
        where o.tarefa_id = t.id
          and o.usuario_id = auth.uid()
      )
  );
$$;

-- Usuário logado é Responsável ou Visualizador da própria subtarefa.
create or replace function public.is_subtarefa_participante(p_subtarefa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subtarefas s
    join public.tarefas t on t.id = s.tarefa_id
    where s.id = p_subtarefa_id
      and t.deleted_at is null
      and public.is_active_user()
      and public.can_read_tarefa(t.id)
      and (
        exists (
          select 1
          from public.subtarefa_responsaveis r
          where r.subtarefa_id = s.id
            and r.usuario_id = auth.uid()
        )
        or exists (
          select 1
          from public.subtarefa_observadores o
          where o.subtarefa_id = s.id
            and o.usuario_id = auth.uid()
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Tarefas: Visualizador também pode atualizar a linha (data / conclusão).
-- O que ele pode de fato alterar é limitado pelo trigger mais abaixo.
-- -----------------------------------------------------------------------------

drop policy if exists "tarefas_update" on public.tarefas;
create policy "tarefas_update"
  on public.tarefas
  for update
  to authenticated
  using (public.can_write_tarefa(id) or public.is_tarefa_observador(id))
  with check (public.can_write_tarefa(id) or public.is_tarefa_observador(id));

-- Responsáveis/Visualizadores da tarefa: qualquer participante pode ADICIONAR.
-- (DELETE segue como estava: a restrição de remoção é feita na interface.)
drop policy if exists "tarefa_responsaveis_insert" on public.tarefa_responsaveis;
create policy "tarefa_responsaveis_insert"
  on public.tarefa_responsaveis
  for insert
  to authenticated
  with check (
    public.can_write_tarefa(tarefa_id)
    or public.is_tarefa_observador(tarefa_id)
    or exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_id
        and t.criado_por = auth.uid()
        and t.deleted_at is null
    )
  );

drop policy if exists "tarefa_observadores_insert" on public.tarefa_observadores;
create policy "tarefa_observadores_insert"
  on public.tarefa_observadores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_observadores.tarefa_id
        and (
          public.can_write_tarefa(t.id)
          or public.is_tarefa_observador(t.id)
        )
    )
  );

-- -----------------------------------------------------------------------------
-- Tarefas: guarda de colunas para chamadas diretas do cliente
-- -----------------------------------------------------------------------------
-- Só vale para o papel `authenticated` (PostgREST). Funções SECURITY DEFINER
-- (materialização de recorrência, RPCs) rodam como dono e passam direto.

create or replace function public.guard_tarefa_campos_participante()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or current_user <> 'authenticated' then
    return new;
  end if;

  -- Criador, Gestor do setor e Administrador: sem restrição de colunas aqui.
  if public.is_admin()
     or old.criado_por = v_uid
     or public.manages_setor(old.setor_id) then
    return new;
  end if;

  -- Responsável e Visualizador: não editam Título nem Descrição.
  if new.titulo is distinct from old.titulo
     or coalesce(new.descricao, '') is distinct from coalesce(old.descricao, '') then
    raise exception
      'Apenas o criador, o gestor ou o administrador podem editar o título e a descrição da tarefa.';
  end if;

  -- Visualizador (que não é Responsável): só Data e conclusão.
  if not public.can_write_tarefa(old.id) then
    if new.projeto_id is distinct from old.projeto_id
       or new.setor_id is distinct from old.setor_id
       or new.prioridade is distinct from old.prioridade
       or new.tags is distinct from old.tags
       or new.lembretes is distinct from old.lembretes
       or new.deleted_at is distinct from old.deleted_at then
      raise exception
        'Visualizadores podem apenas adicionar pessoas, concluir, alterar data e hora, comentar e anexar.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tarefas_guard_campos_participante on public.tarefas;
create trigger tarefas_guard_campos_participante
  before update on public.tarefas
  for each row
  execute function public.guard_tarefa_campos_participante();

-- -----------------------------------------------------------------------------
-- Subtarefas: Responsável/Visualizador da própria subtarefa
-- -----------------------------------------------------------------------------

drop policy if exists "subtarefas_update" on public.subtarefas;
create policy "subtarefas_update"
  on public.subtarefas
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = subtarefas.tarefa_id
        and public.can_write_tarefa(t.id)
    )
    or public.is_subtarefa_participante(subtarefas.id)
  )
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = subtarefas.tarefa_id
        and public.can_write_tarefa(t.id)
    )
    or public.is_subtarefa_participante(subtarefas.id)
  );

drop policy if exists "subtarefa_responsaveis_insert" on public.subtarefa_responsaveis;
create policy "subtarefa_responsaveis_insert"
  on public.subtarefa_responsaveis
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_responsaveis.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
    or public.is_subtarefa_participante(subtarefa_responsaveis.subtarefa_id)
  );

drop policy if exists "subtarefa_observadores_insert" on public.subtarefa_observadores;
create policy "subtarefa_observadores_insert"
  on public.subtarefa_observadores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.subtarefas s
      where s.id = subtarefa_observadores.subtarefa_id
        and public.can_write_tarefa(s.tarefa_id)
    )
    or public.is_subtarefa_participante(subtarefa_observadores.subtarefa_id)
  );

-- Participante da subtarefa que NÃO tem poder de escrita na tarefa pai:
-- só pode mexer em conclusão e Data/Hora (nunca Título, Descrição etc.).
create or replace function public.guard_subtarefa_campos_participante()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or current_user <> 'authenticated' then
    return new;
  end if;

  if public.is_admin()
     or old.criado_por = v_uid
     or public.can_write_tarefa(old.tarefa_id) then
    return new;
  end if;

  if new.titulo is distinct from old.titulo
     or coalesce(new.descricao, '') is distinct from coalesce(old.descricao, '')
     or new.tarefa_id is distinct from old.tarefa_id
     or new.projeto_id is distinct from old.projeto_id
     or new.setor_id is distinct from old.setor_id
     or new.prioridade is distinct from old.prioridade
     or new.lembretes is distinct from old.lembretes
     or new.posicao is distinct from old.posicao
     or new.criado_por is distinct from old.criado_por then
    raise exception
      'Responsáveis e visualizadores da subtarefa podem apenas adicionar pessoas, concluir, alterar data e hora, comentar e anexar.';
  end if;

  return new;
end;
$$;

drop trigger if exists subtarefas_guard_campos_participante on public.subtarefas;
create trigger subtarefas_guard_campos_participante
  before update on public.subtarefas
  for each row
  execute function public.guard_subtarefa_campos_participante();
