-- =============================================================================
-- Correção compartilhada: permissões na criação de Tarefas e Avisos
-- Causa raiz: políticas de leitura pós-INSERT e subconsultas RLS em tabelas filhas
-- =============================================================================

create or replace function public.is_aviso_creator(target_aviso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.avisos a
    where a.id = target_aviso_id
      and a.criado_por = auth.uid()
  );
$$;

create or replace function public.can_read_aviso(target_aviso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.avisos a
    where a.id = target_aviso_id
      and public.is_active_user()
      and (
        public.is_admin_or_gerente()
        or a.criado_por = auth.uid()
        or a.alcance = 'todos'
        or (
          a.alcance = 'por_setor'
          and exists (
            select 1
            from public.aviso_setores s
            where s.aviso_id = a.id
              and s.setor_id = public.my_setor_id()
          )
        )
        or (
          a.alcance = 'pessoa_especifica'
          and exists (
            select 1
            from public.aviso_pessoas p
            where p.aviso_id = a.id
              and p.usuario_id = auth.uid()
          )
        )
      )
  );
$$;

drop policy if exists "avisos_insert" on public.avisos;

create policy "avisos_insert"
  on public.avisos
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and public.is_admin_or_gerente()
    and criado_por = auth.uid()
  );

drop policy if exists "aviso_setores_insert" on public.aviso_setores;

create policy "aviso_setores_insert"
  on public.aviso_setores
  for insert
  to authenticated
  with check (
    public.is_admin_or_gerente()
    and public.is_aviso_creator(aviso_id)
  );

drop policy if exists "aviso_pessoas_insert" on public.aviso_pessoas;

create policy "aviso_pessoas_insert"
  on public.aviso_pessoas
  for insert
  to authenticated
  with check (
    public.is_admin_or_gerente()
    and public.is_aviso_creator(aviso_id)
  );

-- Permite exibir nomes/avatars em embeds (responsável, pessoas de avisos, etc.)
drop policy if exists "profiles_select_active" on public.profiles;

create policy "profiles_select_active"
  on public.profiles
  for select
  to authenticated
  using (ativo = true);

create or replace function public.notify_user(
  p_usuario_id uuid,
  p_tipo text,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_caller uuid := auth.uid();
  v_can_notify boolean := false;
begin
  if v_caller is null then
    raise exception 'Não autenticado';
  end if;

  if p_usuario_id is null then
    raise exception 'usuario_id obrigatório';
  end if;

  if p_usuario_id = v_caller and p_tipo not in ('sistema', 'aviso') then
    return null;
  end if;

  if p_usuario_id = v_caller or public.is_admin_or_gerente() then
    v_can_notify := true;
  elsif p_referencia_tipo = 'tarefa' and p_referencia_id is not null then
    v_can_notify := public.can_write_tarefa(p_referencia_id)
      or public.can_read_tarefa(p_referencia_id);
  elsif p_referencia_tipo = 'aviso' and p_referencia_id is not null then
    v_can_notify := public.can_read_aviso(p_referencia_id);
  end if;

  if not v_can_notify then
    raise exception 'Sem permissão para notificar este usuário';
  end if;

  insert into public.notificacoes (usuario_id, tipo, referencia_tipo, referencia_id)
  values (p_usuario_id, p_tipo, p_referencia_tipo, p_referencia_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.is_aviso_creator(uuid) to authenticated;
grant execute on function public.notify_user(uuid, text, text, uuid) to authenticated;
