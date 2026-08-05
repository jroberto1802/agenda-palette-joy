-- =============================================================================
-- Corrige a validação da âncora no motor de recorrência
-- =============================================================================
-- Bug: `recorrencia_expandir_datas` aceitava a âncora (data_ancora / data de
-- início do modelo) como primeira ocorrência SEM checar se ela realmente
-- satisfaz a regra (dia da semana em "semanal", dia do mês em "mensal").
--
-- Efeito observado: criar uma tarefa "toda quinta" numa quarta-feira gerava
-- (errado) uma ocorrência JÁ na quarta (dia da criação) e, no dia seguinte,
-- outra ocorrência correta na quinta — dando a impressão de recorrência
-- diária em vez de semanal.
--
-- Correção: antes de aceitar o cursor (âncora) como ocorrência válida,
-- valida contra a regra; se não bater, avança normalmente via
-- `recorrencia_proxima_data` até achar a primeira data que realmente
-- satisfaça a periodicidade configurada.
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

    -- Sem dias definidos: qualquer dia serve como referência (regra legada)
    if coalesce(array_length(v_dias, 1), 0) = 0 then
      return true;
    end if;

    return extract(dow from p_data)::int = any (v_dias);
  end if;

  if v_tipo = 'mensal' then
    v_dia_mes := coalesce((p_config->>'dia_mes')::int, extract(day from p_data)::int);
    return extract(day from p_data)::int = least(greatest(v_dia_mes, 1), 28);
  end if;

  -- diaria, anual, personalizada: qualquer data serve como ponto de partida
  return true;
end;
$$;

comment on function public.recorrencia_ancora_valida(date, jsonb) is
  'Indica se a data realmente satisfaz a regra de periodicidade (dia da semana/mês), usado para não aceitar a âncora como ocorrência quando ela não corresponde ao dia configurado.';

grant execute on function public.recorrencia_ancora_valida(date, jsonb)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Expansão das datas de ocorrência em [p_de, p_ate] — agora validando a âncora
-- -----------------------------------------------------------------------------
create or replace function public.recorrencia_expandir_datas(
  p_ancora date,
  p_config jsonb,
  p_de date,
  p_ate date,
  p_max integer default 366
)
returns setof date
language plpgsql
stable
as $$
declare
  v_tipo text := coalesce(p_config->>'tipo', 'nenhuma');
  v_max int := greatest(coalesce(p_max, 366), 1);
  v_fim date := nullif(p_config->>'data_fim', '')::date;
  v_count int := 0;
  v_guard int := 0;
  v_cursor date;
  v_next date;
  v_livre text;
begin
  if v_tipo = 'nenhuma' or p_de is null or p_ate is null or p_de > p_ate then
    return;
  end if;

  -- Datas livres não usam o motor: são a própria lista
  if v_tipo = 'personalizada'
     and jsonb_typeof(p_config->'datas_livres') = 'array'
     and jsonb_array_length(p_config->'datas_livres') > 0 then
    for v_livre in
      select t.x
      from jsonb_array_elements_text(p_config->'datas_livres') as t(x)
      order by t.x
    loop
      v_cursor := nullif(v_livre, '')::date;
      if v_cursor is null then
        continue;
      end if;
      if v_cursor < p_de or v_cursor > p_ate then
        continue;
      end if;
      if v_fim is not null and v_cursor > v_fim then
        continue;
      end if;
      return next v_cursor;
      v_count := v_count + 1;
      exit when v_count >= v_max;
    end loop;
    return;
  end if;

  v_cursor := coalesce(p_ancora, p_de);

  -- Avança até estar dentro da janela pedida E satisfazer a regra
  -- (dia da semana / dia do mês). Sem a checagem de regra, a âncora era
  -- aceita como ocorrência mesmo quando não correspondia ao dia configurado.
  while (v_cursor < p_de or not public.recorrencia_ancora_valida(v_cursor, p_config))
        and v_guard < 5000 loop
    v_next := public.recorrencia_proxima_data(v_cursor, p_config);
    if v_next is null then
      return;
    end if;
    if v_fim is not null and v_next > v_fim then
      return;
    end if;
    v_cursor := v_next;
    v_guard := v_guard + 1;
  end loop;

  if v_cursor >= p_de
     and v_cursor <= p_ate
     and (v_fim is null or v_cursor <= v_fim) then
    return next v_cursor;
    v_count := v_count + 1;
  end if;

  while v_count < v_max loop
    v_next := public.recorrencia_proxima_data(v_cursor, p_config);
    if v_next is null then
      exit;
    end if;
    if v_fim is not null and v_next > v_fim then
      exit;
    end if;
    v_cursor := v_next;
    exit when v_cursor > p_ate;
    if v_cursor >= p_de then
      return next v_cursor;
      v_count := v_count + 1;
    end if;
  end loop;

  return;
end;
$$;

comment on function public.recorrencia_expandir_datas(date, jsonb, date, date, integer) is
  'Datas de ocorrência da série no intervalo [p_de, p_ate], a partir da âncora — só aceita a âncora em si quando ela satisfaz a regra (dia da semana/mês).';

-- -----------------------------------------------------------------------------
-- Auto-cura: recalcula a próxima data de todos os modelos ativos com a regra
-- corrigida (não recria ocorrências já existentes, só realinha o apontador).
-- -----------------------------------------------------------------------------
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
  loop
    perform public.recorrencia_atualizar_proxima_data(v_modelo.id);
  end loop;
end
$do$;

-- Catch-up imediato (só hoje) com a regra corrigida
select public.materializar_ocorrencias_recorrencia(0);
