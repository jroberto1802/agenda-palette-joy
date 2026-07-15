-- =============================================================================
-- Edição/exclusão de comentários (tarefa + subtarefa) com prazo e rastreio
-- =============================================================================

alter table public.tarefa_comentarios
  add column if not exists editado_em timestamptz,
  add column if not exists editado_por uuid references public.profiles (id) on delete set null;

alter table public.subtarefa_comentarios
  add column if not exists editado_em timestamptz,
  add column if not exists editado_por uuid references public.profiles (id) on delete set null;

create index if not exists tarefa_comentarios_editado_por_idx
  on public.tarefa_comentarios (editado_por);

create index if not exists subtarefa_comentarios_editado_por_idx
  on public.subtarefa_comentarios (editado_por);

create or replace function public.can_mutate_comentario(
  p_autor_id uuid,
  p_created_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_papel text;
  v_autor_papel text;
begin
  if not public.is_active_user() then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  select papel into v_papel from public.profiles where id = auth.uid();
  if v_papel is null then
    return false;
  end if;

  -- Comentário próprio
  if p_autor_id is not null and p_autor_id = auth.uid() then
    if v_papel = 'gerente' then
      return true;
    end if;
    -- Usuário comum: janela de 20 minutos
    return p_created_at >= (now() - interval '20 minutes');
  end if;

  -- Comentário de outra pessoa: só gestor, e apenas se o autor for usuário comum
  if v_papel = 'gerente' then
    select papel into v_autor_papel from public.profiles where id = p_autor_id;
    return coalesce(v_autor_papel, 'usuario') not in ('admin', 'gerente');
  end if;

  return false;
end;
$$;

-- Policies tarefa_comentarios
drop policy if exists "tarefa_comentarios_update_own" on public.tarefa_comentarios;
drop policy if exists "tarefa_comentarios_update" on public.tarefa_comentarios;
drop policy if exists "tarefa_comentarios_delete" on public.tarefa_comentarios;

create policy "tarefa_comentarios_update"
  on public.tarefa_comentarios
  for update
  to authenticated
  using (public.can_mutate_comentario(usuario_id, created_at))
  with check (public.can_mutate_comentario(usuario_id, created_at));

create policy "tarefa_comentarios_delete"
  on public.tarefa_comentarios
  for delete
  to authenticated
  using (public.can_mutate_comentario(usuario_id, created_at));

-- Policies subtarefa_comentarios
drop policy if exists "subtarefa_comentarios_update" on public.subtarefa_comentarios;
drop policy if exists "subtarefa_comentarios_delete" on public.subtarefa_comentarios;

create policy "subtarefa_comentarios_update"
  on public.subtarefa_comentarios
  for update
  to authenticated
  using (public.can_mutate_comentario(usuario_id, created_at))
  with check (public.can_mutate_comentario(usuario_id, created_at));

create policy "subtarefa_comentarios_delete"
  on public.subtarefa_comentarios
  for delete
  to authenticated
  using (public.can_mutate_comentario(usuario_id, created_at));
