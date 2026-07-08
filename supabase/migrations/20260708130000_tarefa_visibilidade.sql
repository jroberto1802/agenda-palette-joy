-- =============================================================================
-- Visibilidade e lembretes em tarefas + RLS atualizado
-- =============================================================================

alter table public.tarefas
  add column if not exists visibilidade text not null default 'todos_setor'
    check (visibilidade in ('todos_empresa', 'todos_setor', 'somente_para_mim', 'pessoas_especificas'));

alter table public.tarefas
  add column if not exists lembretes jsonb not null default '[]'::jsonb;

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
      and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.ativo = true
      )
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
