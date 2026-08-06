-- =============================================================================
-- Corrige cálculo da próxima data em recorrência mensal
-- =============================================================================
-- Bug: `recorrencia_proxima_data` (e o espelho em TS `calcularProximaData`)
-- sempre avançava 1 mês e só depois aplicava `dia_mes`. Ao criar uma série
-- "todo dia 23" no dia 06/08, a primeira ocorrência ia para 23/09 em vez de
-- 23/08.
--
-- Regra correta (próxima data estritamente após p_atual):
--   - se o dia configurado ainda ocorrer no mês vigente → usa o mês atual;
--   - se o dia já passou (ou é o próprio p_atual) → usa o mês seguinte.
-- =============================================================================

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
    -- Mês vigente: se o dia configurado ainda não passou, usa este mês
    v_cand := make_date(
      extract(year from p_atual)::int,
      extract(month from p_atual)::int,
      v_dia_mes
    );
    if v_cand > p_atual then
      return v_cand;
    end if;
    -- Dia já passou (ou é o próprio p_atual): próximo mês
    v_base := (date_trunc('month', p_atual::timestamp) + interval '1 month')::date;
    return make_date(
      extract(year from v_base)::int,
      extract(month from v_base)::int,
      v_dia_mes
    );
  end if;

  if v_tipo = 'anual' then
    v_intervalo := greatest(coalesce((p_config->>'intervalo')::int, 1), 1);
    return (p_atual + make_interval(years => v_intervalo))::date;
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
  'Próxima data da regra de recorrência, estritamente após p_atual. Em mensal, usa o mês vigente quando o dia configurado ainda não passou.';

-- Realinha o apontador da próxima data nos modelos ativos (não recria ocorrências).
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
      and coalesce(recorrencia->>'tipo', '') = 'mensal'
  loop
    perform public.recorrencia_atualizar_proxima_data(v_modelo.id);
  end loop;
end
$do$;
