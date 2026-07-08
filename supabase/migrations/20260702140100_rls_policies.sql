-- =============================================================================
-- Agenda Interna Corporativa — Row Level Security (Fase 2)
-- =============================================================================

alter table public.setores enable row level security;
alter table public.profiles enable row level security;
alter table public.tarefas enable row level security;
alter table public.subtarefas enable row level security;
alter table public.tarefa_comentarios enable row level security;
alter table public.tarefa_anexos enable row level security;
alter table public.tarefa_observadores enable row level security;
alter table public.tarefa_historico enable row level security;
alter table public.avisos enable row level security;
alter table public.aviso_setores enable row level security;
alter table public.aviso_pessoas enable row level security;
alter table public.aviso_comentarios enable row level security;
alter table public.aviso_lido_por enable row level security;
alter table public.notificacoes enable row level security;

-- -----------------------------------------------------------------------------
-- setores
-- -----------------------------------------------------------------------------

create policy "setores_select_authenticated"
  on public.setores
  for select
  to authenticated
  using (true);

create policy "setores_insert_admin"
  on public.setores
  for insert
  to authenticated
  with check (public.is_admin());

create policy "setores_update_admin_or_gerente"
  on public.setores
  for update
  to authenticated
  using (public.is_admin() or public.manages_setor(id))
  with check (public.is_admin() or public.manages_setor(id));

create policy "setores_delete_admin"
  on public.setores
  for delete
  to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      ativo = true
      and setor_id is not null
      and setor_id = public.my_setor_id()
    )
    or (
      ativo = true
      and public.is_gerente()
      and public.manages_setor(setor_id)
    )
  );

create policy "profiles_insert_admin"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_admin());

create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_update_gerente_setor"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_gerente()
    and setor_id = public.my_setor_id()
    and papel <> 'admin'
  )
  with check (
    public.is_gerente()
    and setor_id = public.my_setor_id()
    and papel <> 'admin'
  );

create policy "profiles_delete_admin"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- tarefas
-- -----------------------------------------------------------------------------

create policy "tarefas_select"
  on public.tarefas
  for select
  to authenticated
  using (public.can_read_tarefa(id));

create policy "tarefas_insert"
  on public.tarefas
  for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo = true)
    and (
      public.is_admin_or_gerente()
      or public.can_access_setor(setor_id)
    )
    and criado_por = auth.uid()
  );

create policy "tarefas_update"
  on public.tarefas
  for update
  to authenticated
  using (public.can_write_tarefa(id))
  with check (public.can_write_tarefa(id));

create policy "tarefas_delete_admin"
  on public.tarefas
  for delete
  to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- subtarefas (herda acesso da tarefa pai)
-- -----------------------------------------------------------------------------

create policy "subtarefas_select"
  on public.subtarefas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = subtarefas.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "subtarefas_insert"
  on public.subtarefas
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = subtarefas.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

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
  )
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = subtarefas.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

create policy "subtarefas_delete"
  on public.subtarefas
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = subtarefas.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

-- -----------------------------------------------------------------------------
-- tarefa_comentarios
-- -----------------------------------------------------------------------------

create policy "tarefa_comentarios_select"
  on public.tarefa_comentarios
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_comentarios.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_comentarios_insert"
  on public.tarefa_comentarios
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_comentarios.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_comentarios_update_own"
  on public.tarefa_comentarios
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "tarefa_comentarios_delete"
  on public.tarefa_comentarios
  for delete
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.is_admin_or_gerente()
  );

-- -----------------------------------------------------------------------------
-- tarefa_anexos
-- -----------------------------------------------------------------------------

create policy "tarefa_anexos_select"
  on public.tarefa_anexos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_anexos.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_anexos_insert"
  on public.tarefa_anexos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_anexos.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

create policy "tarefa_anexos_delete"
  on public.tarefa_anexos
  for delete
  to authenticated
  using (
    public.is_admin_or_gerente()
    or exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_anexos.tarefa_id
        and t.criado_por = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- tarefa_observadores
-- -----------------------------------------------------------------------------

create policy "tarefa_observadores_select"
  on public.tarefa_observadores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_observadores.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_observadores_insert"
  on public.tarefa_observadores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_observadores.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

create policy "tarefa_observadores_delete"
  on public.tarefa_observadores
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_observadores.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

-- -----------------------------------------------------------------------------
-- tarefa_historico (somente leitura para usuários com acesso à tarefa)
-- -----------------------------------------------------------------------------

create policy "tarefa_historico_select"
  on public.tarefa_historico
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_historico.tarefa_id
        and public.can_read_tarefa(t.id)
    )
  );

create policy "tarefa_historico_insert"
  on public.tarefa_historico
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_historico.tarefa_id
        and public.can_write_tarefa(t.id)
    )
  );

-- -----------------------------------------------------------------------------
-- avisos
-- -----------------------------------------------------------------------------

create policy "avisos_select"
  on public.avisos
  for select
  to authenticated
  using (public.can_read_aviso(id));

create policy "avisos_insert"
  on public.avisos
  for insert
  to authenticated
  with check (
    public.is_admin_or_gerente()
    and criado_por = auth.uid()
  );

create policy "avisos_update"
  on public.avisos
  for update
  to authenticated
  using (
    public.is_admin()
    or criado_por = auth.uid()
    or (
      public.is_gerente()
      and criado_por = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or criado_por = auth.uid()
  );

create policy "avisos_delete"
  on public.avisos
  for delete
  to authenticated
  using (public.is_admin() or criado_por = auth.uid());

-- -----------------------------------------------------------------------------
-- aviso_setores / aviso_pessoas (via aviso pai)
-- -----------------------------------------------------------------------------

create policy "aviso_setores_select"
  on public.aviso_setores
  for select
  to authenticated
  using (public.can_read_aviso(aviso_id));

create policy "aviso_setores_insert"
  on public.aviso_setores
  for insert
  to authenticated
  with check (
    public.is_admin_or_gerente()
    and exists (
      select 1 from public.avisos a
      where a.id = aviso_setores.aviso_id
        and a.criado_por = auth.uid()
    )
  );

create policy "aviso_setores_delete"
  on public.aviso_setores
  for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.avisos a
      where a.id = aviso_setores.aviso_id
        and a.criado_por = auth.uid()
    )
  );

create policy "aviso_pessoas_select"
  on public.aviso_pessoas
  for select
  to authenticated
  using (public.can_read_aviso(aviso_id));

create policy "aviso_pessoas_insert"
  on public.aviso_pessoas
  for insert
  to authenticated
  with check (
    public.is_admin_or_gerente()
    and exists (
      select 1 from public.avisos a
      where a.id = aviso_pessoas.aviso_id
        and a.criado_por = auth.uid()
    )
  );

create policy "aviso_pessoas_delete"
  on public.aviso_pessoas
  for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.avisos a
      where a.id = aviso_pessoas.aviso_id
        and a.criado_por = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- aviso_comentarios
-- -----------------------------------------------------------------------------

create policy "aviso_comentarios_select"
  on public.aviso_comentarios
  for select
  to authenticated
  using (public.can_read_aviso(aviso_id));

create policy "aviso_comentarios_insert"
  on public.aviso_comentarios
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and public.can_read_aviso(aviso_id)
    and exists (
      select 1
      from public.avisos a
      where a.id = aviso_comentarios.aviso_id
        and a.comentarios_permitidos = true
    )
  );

create policy "aviso_comentarios_update_own"
  on public.aviso_comentarios
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "aviso_comentarios_delete"
  on public.aviso_comentarios
  for delete
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.is_admin_or_gerente()
  );

-- -----------------------------------------------------------------------------
-- aviso_lido_por
-- -----------------------------------------------------------------------------

create policy "aviso_lido_por_select"
  on public.aviso_lido_por
  for select
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.is_admin_or_gerente()
  );

create policy "aviso_lido_por_insert"
  on public.aviso_lido_por
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and public.can_read_aviso(aviso_id)
  );

create policy "aviso_lido_por_update_own"
  on public.aviso_lido_por
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- -----------------------------------------------------------------------------
-- notificações (somente o próprio usuário)
-- -----------------------------------------------------------------------------

create policy "notificacoes_select_own"
  on public.notificacoes
  for select
  to authenticated
  using (usuario_id = auth.uid());

create policy "notificacoes_insert_system"
  on public.notificacoes
  for insert
  to authenticated
  with check (
    public.is_admin_or_gerente()
    or usuario_id = auth.uid()
  );

create policy "notificacoes_update_own"
  on public.notificacoes
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "notificacoes_delete_own"
  on public.notificacoes
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.is_admin());
