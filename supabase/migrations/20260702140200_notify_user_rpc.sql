-- =============================================================================
-- Fase 4: função RPC para criar notificações com validação de contexto
-- =============================================================================

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
begin
  if v_caller is null then
    raise exception 'Não autenticado';
  end if;

  if p_usuario_id is null then
    raise exception 'usuario_id obrigatório';
  end if;

  -- Não notificar a si mesmo em eventos de sistema (evita ruído)
  if p_usuario_id = v_caller and p_tipo not in ('sistema', 'aviso') then
    return null;
  end if;

  if p_usuario_id <> v_caller and not public.is_admin_or_gerente() then
    if p_referencia_tipo = 'tarefa' and p_referencia_id is not null then
      if not public.can_write_tarefa(p_referencia_id) and not public.can_read_tarefa(p_referencia_id) then
        raise exception 'Sem permissão para notificar este usuário';
      end if;
    elsif p_referencia_tipo = 'aviso' and p_referencia_id is not null then
      if not public.can_read_aviso(p_referencia_id) then
        raise exception 'Sem permissão para notificar este usuário';
      end if;
    else
      raise exception 'Sem permissão para notificar este usuário';
    end if;
  end if;

  insert into public.notificacoes (usuario_id, tipo, referencia_tipo, referencia_id)
  values (p_usuario_id, p_tipo, p_referencia_tipo, p_referencia_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.notify_user(uuid, text, text, uuid) to authenticated;
