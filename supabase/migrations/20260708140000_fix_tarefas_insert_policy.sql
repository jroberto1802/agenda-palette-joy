-- =============================================================================
-- Corrige criação de tarefas: qualquer usuário ativo pode inserir se for o criador
-- =============================================================================

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and ativo = true
  );
$$;

drop policy if exists "tarefas_insert" on public.tarefas;

create policy "tarefas_insert"
  on public.tarefas
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and criado_por = auth.uid()
  );

-- Garante que o criador sempre consegue ler a tarefa recém-criada (RETURNING / embeds)
create or replace function public.can_read_tarefa(tarefa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tarefas t
    where t.id = tarefa_id
      and t.deleted_at is null
      and public.is_active_user()
      and (
        public.is_admin()
        or t.criado_por = auth.uid()
        or t.atribuido_a = auth.uid()
        or t.visibilidade = 'todos_empresa'
        or (
          t.visibilidade = 'todos_setor'
          and t.setor_id is not null
          and (
            t.setor_id = public.my_setor_id()
            or public.manages_setor(t.setor_id)
          )
        )
        or (
          t.visibilidade = 'somente_para_mim'
          and public.manages_setor(t.setor_id)
        )
        or (
          t.visibilidade = 'pessoas_especificas'
          and exists (
            select 1
            from public.tarefa_observadores o
            where o.tarefa_id = t.id and o.usuario_id = auth.uid()
          )
        )
      )
  );
$$;
