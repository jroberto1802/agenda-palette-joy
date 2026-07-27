-- =============================================================================
-- Limite de 500 KB (512.000 bytes) por arquivo anexado
-- =============================================================================

-- Storage: validação definitiva no upload do bucket (bloqueia arquivos novos)
update storage.buckets
set file_size_limit = 512000
where id = 'tarefa-anexos';

-- Metadados: impede novos registros acima do limite.
-- NOT VALID: não falha em anexos históricos já maiores que 500 KB.
alter table public.tarefa_anexos
  drop constraint if exists tarefa_anexos_tamanho_maximo_check;

alter table public.tarefa_anexos
  add constraint tarefa_anexos_tamanho_maximo_check
  check (tamanho is null or tamanho <= 512000) not valid;

alter table public.subtarefa_anexos
  drop constraint if exists subtarefa_anexos_tamanho_maximo_check;

alter table public.subtarefa_anexos
  add constraint subtarefa_anexos_tamanho_maximo_check
  check (tamanho is null or tamanho <= 512000) not valid;
