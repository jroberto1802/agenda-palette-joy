-- =============================================================================
-- APPLY: limpeza de lixo de recorrência (subtarefas / ocorrências inválidas)
--
-- CUIDADO: altera dados. Preferir:
--   npm run limpar:serie -- --apply
--
-- Ou:
--   npx supabase db query --linked -f scripts/sql/limpar-serie-recorrencia.apply.sql
--
-- O que faz (nessa ordem, em uma transação):
--  1) Zera recorrencia em TODAS as subtarefas
--  2) Soft-delete de ocorrências duplicadas no mesmo dia (mantém a mais antiga)
--  3) Soft-delete de ocorrências cuja data não bate com a regra do modelo
--     (mensal / semanal / anual / personalizada com datas_livres)
--  4) Remove subtarefas duplicadas na mesma ocorrência (mesmo título; mantém a mais antiga)
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Subtarefas nunca têm recorrência própria
-- ---------------------------------------------------------------------------
update public.subtarefas
set
  recorrencia = null,
  updated_at = now()
where recorrencia is not null;

-- ---------------------------------------------------------------------------
-- 2) Duplicatas: mesma série + mesmo dia civil → soft-delete extras
-- ---------------------------------------------------------------------------
with ranked as (
  select
    o.id,
    row_number() over (
      partition by
        o.serie_raiz_id,
        (o.data_inicio at time zone 'America/Sao_Paulo')::date
      order by o.created_at asc nulls last, o.id
    ) as rn
  from public.tarefas o
  where o.deleted_at is null
    and o.serie_raiz_id is not null
    and o.serie_raiz_id <> o.id
    and o.data_inicio is not null
),
extras as (
  select id from ranked where rn > 1
)
update public.tarefas t
set deleted_at = now()
from extras e
where t.id = e.id
  and t.deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3) Ocorrências fora da regra do modelo
-- ---------------------------------------------------------------------------
with modelos as (
  select
    t.id,
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
  select o.id
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
)
update public.tarefas t
set deleted_at = now()
from invalidas i
where t.id = i.id
  and t.deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4) Subtarefas duplicadas na mesma ocorrência (1 título = 1 linha)
--    Só em ocorrências materializadas — templates do modelo ficam intactos.
-- ---------------------------------------------------------------------------
with ranked as (
  select
    s.id,
    row_number() over (
      partition by s.tarefa_id, lower(trim(s.titulo))
      order by s.created_at asc, s.id
    ) as rn
  from public.subtarefas s
  join public.tarefas t on t.id = s.tarefa_id
  where t.deleted_at is null
    and t.serie_raiz_id is not null
    and t.serie_raiz_id <> t.id
),
extras as (
  select id from ranked where rn > 1
)
delete from public.subtarefas s
using extras e
where s.id = e.id;

commit;

-- Resumo pós-limpeza
select 'ok_limpeza_concluida' as status, now() as finished_at;
