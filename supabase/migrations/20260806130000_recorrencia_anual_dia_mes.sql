-- =============================================================================
-- Recorrência anual com dia e mês explícitos
-- =============================================================================
-- Permite configurar a data civil (dia 1–31 + mês 1–12) em que a série anual
-- se repete, em vez de usar obrigatoriamente a data de criação.
--
-- Campos no JSON `recorrencia`:
--   - dia_mes: dia (1–31)
--   - mes: mês (1=Janeiro … 12=Dezembro)
--   - intervalo: a cada N anos (padrão 1)
--
-- Legado (sem dia_mes/mes): mantém o comportamento anterior (mesma data + N anos).
-- Dia inválido no mês (ex.: 31/02) é limitado ao último dia do mês.
-- =============================================================================

create or replace function public.recorrencia_ancora_valida(
  p_data date,
  p_config jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_tipo text := coalesce(p_config->>'tipo', 'nenhuma');
  v_dias int[];
  v_dia_mes int;
  v_mes int;
  v_ano int;
  v_ultimo int;
begin
  if p_data is null then
    return false;
  end if;

  if v_tipo = 'semanal' then
    select coalesce(array_agg(x::int), '{}'::int[])
      into v_dias
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(p_config->'dias_semana') = 'array' then p_config->'dias_semana'
          else '[]'::jsonb
        end
      ) as t(x);

    if coalesce(array_length(v_dias, 1), 0) = 0 then
      return true;
    end if;

    return extract(dow from p_data)::int = any (v_dias);
  end if;

  if v_tipo = 'mensal' then
    v_dia_mes := coalesce((p_config->>'dia_mes')::int, extract(day from p_data)::int);
    return extract(day from p_data)::int = least(greatest(v_dia_mes, 1), 28);
  end if;

  if v_tipo = 'anual' then
    -- Legado sem dia/mês: qualquer data serve como âncora
    if (p_config->>'mes') is null and (p_config->>'dia_mes') is null then
      return true;
    end if;
    v_mes := least(
      greatest(coalesce((p_config->>'mes')::int, extract(month from p_data)::int), 1),
      12
    );
    v_dia_mes := least(
      greatest(coalesce((p_config->>'dia_mes')::int, extract(day from p_data)::int), 1),
      31
    );
    v_ano := extract(year from p_data)::int;
    v_ultimo := extract(
      day from (make_date(v_ano, v_mes, 1) + interval '1 month - 1 day')
    )::int;
    return p_data = make_date(v_ano, v_mes, least(v_dia_mes, v_ultimo));
  end if;

  -- diaria, personalizada: qualquer data serve como ponto de partida
  return true;
end;
$$;

comment on function public.recorrencia_ancora_valida(date, jsonb) is
  'Indica se a data satisfaz a regra (dia da semana / dia do mês / dia+mês anual).';

create or replace function public.recorrencia_proxima_data(
  p_atual date,
  p_config jsonb
)
returns date
language plpgsql
immutable
as $$
declare
  v_tipo text := coalesce(p_config->>'tipo', 'nenhuma');
  v_dias int[];
  v_dia_mes int;
  v_mes int;
  v_ano int;
  v_ultimo int;
  v_intervalo int;
  v_unidade text;
  v_base date;
  v_cand date;
  v_next text;
  i int;
begin
  if p_atual is null or v_tipo = 'nenhuma' then
    return null;
  end if;

  if v_tipo = 'diaria' then
    return p_atual + 1;
  end if;

  if v_tipo = 'semanal' then
    select coalesce(array_agg(x::int), '{}'::int[])
      into v_dias
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(p_config->'dias_semana') = 'array' then p_config->'dias_semana'
          else '[]'::jsonb
        end
      ) as t(x);

    if coalesce(array_length(v_dias, 1), 0) = 0 then
      v_dias := array[extract(dow from p_atual)::int];
    end if;

    for i in 1..14 loop
      v_cand := p_atual + i;
      if extract(dow from v_cand)::int = any (v_dias) then
        return v_cand;
      end if;
    end loop;

    return p_atual + 7;
  end if;

  if v_tipo = 'mensal' then
    v_dia_mes := least(
      greatest(coalesce((p_config->>'dia_mes')::int, extract(day from p_atual)::int), 1),
      28
    );
    v_cand := make_date(
      extract(year from p_atual)::int,
      extract(month from p_atual)::int,
      v_dia_mes
    );
    if v_cand > p_atual then
      return v_cand;
    end if;
    v_base := (date_trunc('month', p_atual::timestamp) + interval '1 month')::date;
    return make_date(
      extract(year from v_base)::int,
      extract(month from v_base)::int,
      v_dia_mes
    );
  end if;

  if v_tipo = 'anual' then
    v_intervalo := greatest(coalesce((p_config->>'intervalo')::int, 1), 1);
    -- Legado: mesma data civil + N anos
    if (p_config->>'mes') is null and (p_config->>'dia_mes') is null then
      return (p_atual + make_interval(years => v_intervalo))::date;
    end if;

    v_mes := least(
      greatest(coalesce((p_config->>'mes')::int, extract(month from p_atual)::int), 1),
      12
    );
    v_dia_mes := least(
      greatest(coalesce((p_config->>'dia_mes')::int, extract(day from p_atual)::int), 1),
      31
    );
    v_ano := extract(year from p_atual)::int;
    v_ultimo := extract(
      day from (make_date(v_ano, v_mes, 1) + interval '1 month - 1 day')
    )::int;
    v_cand := make_date(v_ano, v_mes, least(v_dia_mes, v_ultimo));
    if v_cand > p_atual then
      return v_cand;
    end if;

    v_ano := v_ano + v_intervalo;
    v_ultimo := extract(
      day from (make_date(v_ano, v_mes, 1) + interval '1 month - 1 day')
    )::int;
    return make_date(v_ano, v_mes, least(v_dia_mes, v_ultimo));
  end if;

  if v_tipo = 'personalizada' then
    if jsonb_typeof(p_config->'datas_livres') = 'array'
       and jsonb_array_length(p_config->'datas_livres') > 0 then
      select min(x)
        into v_next
        from jsonb_array_elements_text(p_config->'datas_livres') as t(x)
        where x > to_char(p_atual, 'YYYY-MM-DD');
      if v_next is null then
        return null;
      end if;
      return v_next::date;
    end if;

    v_intervalo := greatest(coalesce((p_config->>'intervalo')::int, 1), 1);
    v_unidade := p_config->>'unidade';

    if v_unidade = 'semanas' then
      return (p_atual + make_interval(weeks => v_intervalo))::date;
    end if;
    if v_unidade = 'meses' then
      return (p_atual + make_interval(months => v_intervalo))::date;
    end if;
    return p_atual + v_intervalo;
  end if;

  return null;
end;
$$;

comment on function public.recorrencia_proxima_data(date, jsonb) is
  'Próxima data da regra, estritamente após p_atual. Anual usa dia_mes+mes quando presentes.';

-- Realinha apontador da próxima data nos modelos anuais ativos.
do $do$
declare
  v_modelo record;
begin
  for v_modelo in
    select id
    from public.tarefas
    where deleted_at is null
      and recorrencia is not null
      and serie_raiz_id is not null
      and serie_raiz_id = id
      and coalesce(recorrencia->>'tipo', '') = 'anual'
  loop
    perform public.recorrencia_atualizar_proxima_data(v_modelo.id);
  end loop;
end
$do$;
