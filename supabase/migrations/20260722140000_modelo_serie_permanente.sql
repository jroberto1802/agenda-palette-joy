-- =============================================================================
-- Modelo da Série permanente
-- =============================================================================
-- Garante que o modelo (serie_raiz_id = id) nunca fique concluído.
-- Ocorrências são linhas distintas; o modelo permanece editável na Agenda.
-- =============================================================================

update public.tarefas
set
  concluida = false,
  data_conclusao = null
where deleted_at is null
  and serie_raiz_id is not null
  and serie_raiz_id = id
  and concluida = true;
