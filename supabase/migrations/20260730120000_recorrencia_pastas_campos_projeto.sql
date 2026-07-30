-- Alinha pastas de recorrência ao modelo de Projeto (descrição + responsável).

alter table public.recorrencia_pastas
  add column if not exists descricao text;

alter table public.recorrencia_pastas
  add column if not exists responsavel_id uuid
    references public.profiles (id) on delete set null;

create index if not exists recorrencia_pastas_responsavel_id_idx
  on public.recorrencia_pastas (responsavel_id)
  where responsavel_id is not null;
