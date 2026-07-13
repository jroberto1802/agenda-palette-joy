-- Comentários aninhados (1 nível): resposta referencia o comentário pai
alter table public.tarefa_comentarios
  add column if not exists parent_id uuid references public.tarefa_comentarios (id) on delete cascade;

alter table public.aviso_comentarios
  add column if not exists parent_id uuid references public.aviso_comentarios (id) on delete cascade;

create index if not exists tarefa_comentarios_parent_id_idx
  on public.tarefa_comentarios (parent_id);

create index if not exists aviso_comentarios_parent_id_idx
  on public.aviso_comentarios (parent_id);

-- Respostas só podem apontar para comentários raiz (parent_id is null)
create or replace function public.enforce_comentario_reply_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if tg_table_name = 'tarefa_comentarios' then
    if exists (
      select 1 from public.tarefa_comentarios
      where id = new.parent_id and parent_id is not null
    ) then
      raise exception 'Apenas um nível de resposta é permitido';
    end if;
  elsif tg_table_name = 'aviso_comentarios' then
    if exists (
      select 1 from public.aviso_comentarios
      where id = new.parent_id and parent_id is not null
    ) then
      raise exception 'Apenas um nível de resposta é permitido';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tarefa_comentarios_reply_depth on public.tarefa_comentarios;
create trigger tarefa_comentarios_reply_depth
  before insert or update of parent_id on public.tarefa_comentarios
  for each row execute function public.enforce_comentario_reply_depth();

drop trigger if exists aviso_comentarios_reply_depth on public.aviso_comentarios;
create trigger aviso_comentarios_reply_depth
  before insert or update of parent_id on public.aviso_comentarios
  for each row execute function public.enforce_comentario_reply_depth();
