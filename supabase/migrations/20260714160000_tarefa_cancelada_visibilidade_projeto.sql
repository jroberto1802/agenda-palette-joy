-- =============================================================================
-- Status: bloqueada → cancelada
-- Visibilidade: adiciona todos_projeto
-- =============================================================================

-- Status migration
update public.tarefas
set status = 'cancelada'
where status = 'bloqueada';

alter table public.tarefas
  drop constraint if exists tarefas_status_check;

alter table public.tarefas
  add constraint tarefas_status_check
  check (status in ('a_fazer', 'em_andamento', 'cancelada', 'concluida'));

-- Visibilidade: incluir todos_projeto
alter table public.tarefas
  drop constraint if exists tarefas_visibilidade_check;

alter table public.tarefas
  add constraint tarefas_visibilidade_check
  check (
    visibilidade in (
      'todos_empresa',
      'todos_setor',
      'todos_projeto',
      'somente_para_mim',
      'pessoas_especificas'
    )
  );

-- RLS: leitura por projeto
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
        or exists (
          select 1
          from public.tarefa_responsaveis r
          where r.tarefa_id = t.id
            and r.usuario_id = auth.uid()
        )
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
          t.visibilidade = 'todos_projeto'
          and t.projeto_id is not null
          and (
            public.is_admin_or_gerente()
            or exists (
              select 1
              from public.projeto_membros pm
              where pm.projeto_id = t.projeto_id
                and pm.usuario_id = auth.uid()
            )
            or exists (
              select 1
              from public.projetos p
              where p.id = t.projeto_id
                and p.responsavel_id = auth.uid()
            )
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
