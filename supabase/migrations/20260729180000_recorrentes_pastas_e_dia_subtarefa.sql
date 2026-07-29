-- Pastas compartilháveis em Recorrentes + dia_no_mes / offset_dias em subtarefas do modelo.

-- -----------------------------------------------------------------------------
-- Pastas
-- -----------------------------------------------------------------------------
create table if not exists public.recorrencia_pastas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_por uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recorrencia_pastas_criado_por_idx
  on public.recorrencia_pastas (criado_por);

create table if not exists public.recorrencia_pasta_membros (
  pasta_id uuid not null references public.recorrencia_pastas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  primary key (pasta_id, usuario_id)
);

create index if not exists recorrencia_pasta_membros_usuario_idx
  on public.recorrencia_pasta_membros (usuario_id);

alter table public.tarefas
  add column if not exists recorrencia_pasta_id uuid
    references public.recorrencia_pastas (id) on delete set null;

create index if not exists tarefas_recorrencia_pasta_id_idx
  on public.tarefas (recorrencia_pasta_id)
  where recorrencia_pasta_id is not null;

-- -----------------------------------------------------------------------------
-- Subtarefas do modelo: Dia fixo (1–31) ou offset explícito
-- -----------------------------------------------------------------------------
alter table public.subtarefas
  add column if not exists dia_no_mes smallint
    check (dia_no_mes is null or (dia_no_mes >= 1 and dia_no_mes <= 31));

alter table public.subtarefas
  add column if not exists offset_dias smallint
    check (offset_dias is null or (offset_dias >= 0 and offset_dias <= 31));

-- -----------------------------------------------------------------------------
-- Helpers RLS (espelho de Projetos)
-- -----------------------------------------------------------------------------
create or replace function public.can_see_recorrencia_pasta(p_pasta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1 from public.recorrencia_pastas p
        where p.id = p_pasta_id and p.criado_por = auth.uid()
      )
      or exists (
        select 1 from public.recorrencia_pasta_membros m
        where m.pasta_id = p_pasta_id and m.usuario_id = auth.uid()
      )
    );
$$;

create or replace function public.can_manage_recorrencia_pasta_membros(p_pasta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1 from public.recorrencia_pastas p
        where p.id = p_pasta_id and p.criado_por = auth.uid()
      )
      or (
        public.is_gerente()
        and (
          exists (
            select 1 from public.recorrencia_pastas p
            where p.id = p_pasta_id and p.criado_por = auth.uid()
          )
          or exists (
            select 1 from public.recorrencia_pasta_membros m
            where m.pasta_id = p_pasta_id and m.usuario_id = auth.uid()
          )
        )
      )
    );
$$;

create or replace function public.can_delete_recorrencia_pasta(p_pasta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1 from public.recorrencia_pastas p
        where p.id = p_pasta_id and p.criado_por = auth.uid()
      )
      or (
        public.is_gerente()
        and exists (
          select 1 from public.recorrencia_pasta_membros m
          where m.pasta_id = p_pasta_id and m.usuario_id = auth.uid()
        )
      )
    );
$$;

alter table public.recorrencia_pastas enable row level security;
alter table public.recorrencia_pasta_membros enable row level security;

drop policy if exists recorrencia_pastas_select on public.recorrencia_pastas;
create policy recorrencia_pastas_select on public.recorrencia_pastas
  for select using (public.can_see_recorrencia_pasta(id));

drop policy if exists recorrencia_pastas_insert on public.recorrencia_pastas;
create policy recorrencia_pastas_insert on public.recorrencia_pastas
  for insert with check (
    public.is_active_user() and criado_por = auth.uid()
  );

drop policy if exists recorrencia_pastas_update on public.recorrencia_pastas;
create policy recorrencia_pastas_update on public.recorrencia_pastas
  for update using (
    public.is_admin()
    or criado_por = auth.uid()
    or (
      public.is_gerente()
      and public.can_see_recorrencia_pasta(id)
    )
  );

drop policy if exists recorrencia_pastas_delete on public.recorrencia_pastas;
create policy recorrencia_pastas_delete on public.recorrencia_pastas
  for delete using (public.can_delete_recorrencia_pasta(id));

drop policy if exists recorrencia_pasta_membros_select on public.recorrencia_pasta_membros;
create policy recorrencia_pasta_membros_select on public.recorrencia_pasta_membros
  for select using (public.is_active_user());

drop policy if exists recorrencia_pasta_membros_insert on public.recorrencia_pasta_membros;
create policy recorrencia_pasta_membros_insert on public.recorrencia_pasta_membros
  for insert with check (public.can_manage_recorrencia_pasta_membros(pasta_id));

drop policy if exists recorrencia_pasta_membros_delete on public.recorrencia_pasta_membros;
create policy recorrencia_pasta_membros_delete on public.recorrencia_pasta_membros
  for delete using (public.can_manage_recorrencia_pasta_membros(pasta_id));

grant select, insert, update, delete on public.recorrencia_pastas to authenticated;
grant select, insert, delete on public.recorrencia_pasta_membros to authenticated;

-- -----------------------------------------------------------------------------
-- Clone de subtarefas: dia_no_mes | offset_dias | legado offset
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_data_subtarefa_ocorrencia(
  p_subtarefa public.subtarefas,
  p_ancora date,
  p_ocorrencia_dia date,
  p_config jsonb
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_tipo text := coalesce(p_config->>'tipo', 'nenhuma');
  v_offset int;
  v_dia date;
  v_hora time := time '12:00';
  v_last int;
begin
  if p_subtarefa.data_inicio is not null then
    v_hora := coalesce(
      date_trunc('minute', (p_subtarefa.data_inicio at time zone v_tz))::time,
      time '12:00'
    );
  end if;

  -- Dia fixo do mês (mensal / anual / personalizada com datas livres)
  if p_subtarefa.dia_no_mes is not null
     and (
       v_tipo in ('mensal', 'anual')
       or (
         v_tipo = 'personalizada'
         and jsonb_array_length(coalesce(p_config->'datas_livres', '[]'::jsonb)) > 0
       )
     )
  then
    v_last := extract(
      day from (date_trunc('month', p_ocorrencia_dia) + interval '1 month - 1 day')
    )::int;
    v_dia := make_date(
      extract(year from p_ocorrencia_dia)::int,
      extract(month from p_ocorrencia_dia)::int,
      least(p_subtarefa.dia_no_mes, v_last)
    );
    return (v_dia + v_hora) at time zone v_tz;
  end if;

  -- Offset explícito (diária / semanal / intervalo)
  if p_subtarefa.offset_dias is not null then
    v_dia := p_ocorrencia_dia + p_subtarefa.offset_dias;
    return (v_dia + v_hora) at time zone v_tz;
  end if;

  -- Legado: deriva offset a partir de data_inicio do template
  if p_subtarefa.data_inicio is not null then
    v_offset := public.recorrencia_offset_subtarefa(
      (p_subtarefa.data_inicio at time zone v_tz)::date,
      p_ancora,
      p_config
    );
    if v_offset is not null then
      v_dia := p_ocorrencia_dia + v_offset;
      return (v_dia + v_hora) at time zone v_tz;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.recorrencia_clonar_subtarefas(
  p_modelo_id uuid,
  p_ocorrencia_id uuid,
  p_ancora date,
  p_ocorrencia_dia date,
  p_config jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subtarefas%rowtype;
  v_nova_id uuid;
  v_data timestamptz;
  v_criadas int := 0;
begin
  for v_sub in
    select *
    from public.subtarefas
    where tarefa_id = p_modelo_id
    order by posicao asc, created_at asc
  loop
    v_data := public.recorrencia_data_subtarefa_ocorrencia(
      v_sub, p_ancora, p_ocorrencia_dia, p_config
    );

    v_nova_id := gen_random_uuid();

    insert into public.subtarefas (
      id, tarefa_id, titulo, descricao, prioridade, data_inicio,
      projeto_id, setor_id, visibilidade, lembretes, recorrencia,
      posicao, concluida, concluido_por, criado_por, origem_subtarefa_id,
      dia_no_mes, offset_dias
    ) values (
      v_nova_id, p_ocorrencia_id, v_sub.titulo, v_sub.descricao, v_sub.prioridade, v_data,
      v_sub.projeto_id, v_sub.setor_id, v_sub.visibilidade, v_sub.lembretes, null,
      v_sub.posicao, false, null, v_sub.criado_por, v_sub.id,
      null, null
    );

    insert into public.subtarefa_responsaveis (subtarefa_id, usuario_id)
    select v_nova_id, r.usuario_id
    from public.subtarefa_responsaveis r
    where r.subtarefa_id = v_sub.id
    on conflict do nothing;

    insert into public.subtarefa_observadores (subtarefa_id, usuario_id)
    select v_nova_id, o.usuario_id
    from public.subtarefa_observadores o
    where o.subtarefa_id = v_sub.id
    on conflict do nothing;

    v_criadas := v_criadas + 1;
  end loop;

  return v_criadas;
end;
$$;
