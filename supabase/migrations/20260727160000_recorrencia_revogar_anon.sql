-- =============================================================================
-- Materialização de recorrência: fechar o acesso do papel `anon`
-- =============================================================================
-- As default privileges do Supabase concedem EXECUTE em funções de `public`
-- para anon/authenticated. `revoke ... from public` não desfaz esse grant
-- direto, então a materialização ficaria acionável sem autenticação.
-- =============================================================================

revoke execute on function public.materializar_ocorrencias_recorrencia(integer) from anon;
revoke execute on function public.recorrencia_atualizar_proxima_data(uuid) from anon;
revoke execute on function public.recorrencia_clonar_subtarefas(uuid, uuid, date, date, jsonb) from anon;
revoke execute on function public.recorrencia_expandir_datas(date, jsonb, date, date, integer) from anon;
revoke execute on function public.recorrencia_offset_subtarefa(date, date, jsonb) from anon;
revoke execute on function public.recorrencia_proxima_data(date, jsonb) from anon;
