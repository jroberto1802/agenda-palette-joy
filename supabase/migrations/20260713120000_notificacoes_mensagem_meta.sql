-- Notificações específicas: mensagem persistida + meta para deep-link
alter table public.notificacoes
  add column if not exists mensagem text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

drop function if exists public.notify_user(uuid, text, text, uuid);

create or replace function public.notify_user(
  p_usuario_id uuid,
  p_tipo text,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null,
  p_mensagem text default null,
  p_meta jsonb default '{}'::jsonb
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

  -- Quem executa a ação não recebe notificação da própria ação
  if p_usuario_id = v_caller and p_tipo not in ('sistema') then
    return null;
  end if;

  if public.is_admin_or_gerente() then
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

  insert into public.notificacoes (usuario_id, tipo, referencia_tipo, referencia_id, mensagem, meta)
  values (
    p_usuario_id,
    p_tipo,
    p_referencia_tipo,
    p_referencia_id,
    p_mensagem,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.notify_user(uuid, text, text, uuid, text, jsonb) to authenticated;
