import { supabase } from "@/integrations/supabase/client";

export type BuscaProjetoResult = {
  id: string;
  nome: string;
};

export type BuscaTarefaResult = {
  id: string;
  titulo: string;
  trecho: string | null;
};

export type BuscaSubtarefaResult = {
  id: string;
  titulo: string;
  tarefa_id: string;
  trecho: string | null;
};

export type BuscaAvisoResult = {
  id: string;
  titulo: string;
  trecho: string | null;
};

export type BuscaComentarioResult = {
  id: string;
  origem: "tarefa" | "subtarefa";
  tarefa_id: string;
  subtarefa_id: string | null;
  trecho: string;
  contexto: string;
  created_at: string;
};

export type BuscaResultados = {
  projetos: BuscaProjetoResult[];
  tarefas: BuscaTarefaResult[];
  subtarefas: BuscaSubtarefaResult[];
  avisos: BuscaAvisoResult[];
  comentarios: BuscaComentarioResult[];
};

const EMPTY_RESULTADOS: BuscaResultados = {
  projetos: [],
  tarefas: [],
  subtarefas: [],
  avisos: [],
  comentarios: [],
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function countBuscaResultados(resultados: BuscaResultados): number {
  return (
    resultados.projetos.length +
    resultados.tarefas.length +
    resultados.subtarefas.length +
    resultados.avisos.length +
    resultados.comentarios.length
  );
}

export async function buscarConteudo(termo: string): Promise<BuscaResultados> {
  const trimmed = termo.trim();
  if (trimmed.length < 2) return EMPTY_RESULTADOS;

  const { data, error } = await supabase.rpc("buscar_conteudo", {
    p_termo: trimmed,
    p_limite: 20,
  });

  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;

  return {
    projetos: asArray<BuscaProjetoResult>(payload.projetos),
    tarefas: asArray<BuscaTarefaResult>(payload.tarefas),
    subtarefas: asArray<BuscaSubtarefaResult>(payload.subtarefas),
    avisos: asArray<BuscaAvisoResult>(payload.avisos),
    comentarios: asArray<BuscaComentarioResult>(payload.comentarios),
  };
}

/** IDs de tarefas para filtros locais (Agenda / Finalizados / detalhe de projeto). */
export async function buscarTarefaIds(termo: string): Promise<string[]> {
  const trimmed = termo.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("buscar_tarefa_ids", {
    p_termo: trimmed,
  });

  if (error) throw error;
  return Array.isArray(data) ? (data as string[]) : [];
}

/** IDs de projetos para filtro local do menu Projetos. */
export async function buscarProjetoIds(termo: string): Promise<string[]> {
  const trimmed = termo.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("buscar_projeto_ids", {
    p_termo: trimmed,
  });

  if (error) throw error;
  return Array.isArray(data) ? (data as string[]) : [];
}
