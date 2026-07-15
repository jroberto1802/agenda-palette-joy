-- =============================================================================
-- Regras de exclusão de projeto e gestão de membros
-- - Abertas = a_fazer | em_andamento (cancelada/concluida não bloqueiam exclusão simples)
-- - Delete: admin sempre; sem abertas também criador ou gestor
-- - Com abertas: apenas admin (UI exige digitar CONFIRMAR)
-- - projeto_membros: só criador, gestor ou admin gerenciam
-- =============================================================================

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
        and t.status in ('a_fazer', 'em_andamento')
    )
    or exists (
      select 1
      from public.subtarefas s
      join public.tarefas t on t.id = s.tarefa_id
      where t.deleted_at is null
        and (t.projeto_id = p_projeto_id or s.projeto_id = p_projeto_id)
        and s.status in ('a_fazer', 'em_andamento')
    );
$$;

create or replace function public.can_delete_projeto(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projetos p
    where p.id = p_projeto_id
      and public.is_active_user()
      and (
        public.is_admin()
        or (
          not public.projeto_has_open_activities(p.id)
          and (
            public.is_admin_or_gerente()
            or p.criado_por = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.can_manage_projeto_membros(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projetos p
    where p.id = p_projeto_id
      and public.is_active_user()
      and (
        public.is_admin_or_gerente()
        or p.criado_por = auth.uid()
      )
  );
$$;

-- Membros: leitura ampla para usuários ativos; escrita restrita
drop policy if exists "projeto_membros_manage" on public.projeto_membros;
drop policy if exists "projeto_membros_select" on public.projeto_membros;
drop policy if exists "projeto_membros_insert" on public.projeto_membros;
drop policy if exists "projeto_membros_update" on public.projeto_membros;
drop policy if exists "projeto_membros_delete" on public.projeto_membros;

drop policy if exists "projetos_delete_admin_gerente" on public.projetos;
drop policy if exists "projetos_delete" on public.projetos;

create policy "projetos_delete"
  on public.projetos
  for delete
  to authenticated
  using (public.can_delete_projeto(id));

create or replace function public.protect_projeto_with_open_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Com atividades abertas, apenas administrador pode excluir.
  if public.projeto_has_open_activities(old.id) and not public.is_admin() then
    raise exception
      'Não é possível excluir o projeto enquanto houver tarefas ou subtarefas abertas. Somente o administrador pode forçar a exclusão.';
  end if;

  return old;
end;
$$;

drop trigger if exists projetos_protect_with_open_tasks on public.projetos;

create trigger projetos_protect_with_open_tasks
  before delete on public.projetos
  for each row
  execute function public.protect_projeto_with_open_tasks();

create policy "projeto_membros_select"
  on public.projeto_membros
  for select
  to authenticated
  using (public.is_active_user());

create policy "projeto_membros_insert"
  on public.projeto_membros
  for insert
  to authenticated
  with check (public.can_manage_projeto_membros(projeto_id));

create policy "projeto_membros_update"
  on public.projeto_membros
  for update
  to authenticated
  using (public.can_manage_projeto_membros(projeto_id))
  with check (public.can_manage_projeto_membros(projeto_id));

create policy "projeto_membros_delete"
  on public.projeto_membros
  for delete
  to authenticated
  using (public.can_manage_projeto_membros(projeto_id));
