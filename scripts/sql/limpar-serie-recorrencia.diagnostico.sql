-- =============================================================================
-- Diagnóstico unificado (1 resultado só) — limpeza série/recorrência
-- Cole no SQL Editor e rode. Não altera dados.
-- =============================================================================

with
subtarefas_com_recorrencia as (
  select count(*)::int as total
  from public.subtarefas
  where recorrencia is not null
),
ocorrencias_dup as (
  select
    count(*)::int as grupos,
    coalesce(sum(qtd - 1), 0)::int as extras
  from (
    select count(*) as qtd
    from public.tarefas o
    where o.deleted_at is null
      and o.serie_raiz_id is not null
      and o.serie_raiz_id <> o.id
      and o.data_inicio is not null
    group by
      o.serie_raiz_id,
      (o.data_inicio at time zone 'America/Sao_Paulo')::date
    having count(*) > 1
  ) d
),
modelos as (
  select
    t.id,
    t.titulo,
    t.recorrencia,
    coalesce(
      nullif(t.recorrencia->>'data_ancora', '')::date,
      (t.data_inicio at time zone 'America/Sao_Paulo')::date
    ) as ancora
  from public.tarefas t
  where t.deleted_at is null
    and t.serie_raiz_id is not null
    and t.serie_raiz_id = t.id
    and t.recorrencia is not null
    and coalesce(t.recorrencia->>'tipo', 'nenhuma') <> 'nenhuma'
),
ocorrencias as (
  select
    o.id,
    o.titulo,
    o.created_at,
    o.serie_raiz_id,
    m.titulo as modelo_titulo,
    m.recorrencia as regra,
    m.ancora,
    (o.data_inicio at time zone 'America/Sao_Paulo')::date as dia_local
  from public.tarefas o
  join modelos m on m.id = o.serie_raiz_id
  where o.deleted_at is null
    and o.id <> o.serie_raiz_id
    and o.data_inicio is not null
),
invalidas as (
  select *
  from ocorrencias o
  where case o.regra->>'tipo'
    when 'diaria' then false
    when 'mensal' then
      extract(day from o.dia_local)::int
        is distinct from coalesce(
          (o.regra->>'dia_mes')::int,
          extract(day from o.ancora)::int
        )
    when 'semanal' then
      not (
        extract(dow from o.dia_local)::int = any (
          select jsonb_array_elements_text(
            case
              when jsonb_typeof(o.regra->'dias_semana') = 'array'
                and jsonb_array_length(o.regra->'dias_semana') > 0
              then o.regra->'dias_semana'
              else jsonb_build_array(extract(dow from o.ancora)::int)
            end
          )::int
        )
      )
    when 'anual' then
      to_char(o.dia_local, 'MM-DD') is distinct from to_char(o.ancora, 'MM-DD')
    when 'personalizada' then
      case
        when jsonb_typeof(o.regra->'datas_livres') = 'array'
          and jsonb_array_length(o.regra->'datas_livres') > 0
        then not (
          to_char(o.dia_local, 'YYYY-MM-DD') = any (
            select jsonb_array_elements_text(o.regra->'datas_livres')
          )
        )
        else false
      end
    else false
  end
),
subtarefas_dup as (
  select
    count(*)::int as grupos,
    coalesce(sum(qtd - 1), 0)::int as extras
  from (
    select count(*) as qtd
    from public.subtarefas s
    join public.tarefas t on t.id = s.tarefa_id
    where t.deleted_at is null
      and t.serie_raiz_id is not null
      and t.serie_raiz_id <> t.id
    group by s.tarefa_id, lower(trim(s.titulo))
    having count(*) > 1
  ) d
)
select
  ordem,
  check_name,
  quantidade,
  extras_a_remover,
  acao_se_apply
from (
  select
    1 as ordem,
    'subtarefas_com_recorrencia' as check_name,
    (select total from subtarefas_com_recorrencia) as quantidade,
    null::int as extras_a_remover,
    'Zerar campo recorrencia nas subtarefas' as acao_se_apply
  union all
  select
    2,
    'ocorrencias_duplicadas_mesmo_dia',
    (select grupos from ocorrencias_dup),
    (select extras from ocorrencias_dup),
    'Soft-delete das ocorrências extras no mesmo dia'
  union all
  select
    3,
    'ocorrencias_fora_da_regra',
    (select count(*)::int from invalidas),
    null,
    'Soft-delete das ocorrências em dias que não batem com a regra'
  union all
  select
    4,
    'subtarefas_duplicadas_na_ocorrencia',
    (select grupos from subtarefas_dup),
    (select extras from subtarefas_dup),
    'Apagar subtarefas duplicadas (mesmo título) na ocorrência'
) resumo
order by ordem;
