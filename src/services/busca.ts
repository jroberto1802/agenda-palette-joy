import { supabase } from "@/integrations/supabase/client";

export type BuscaProjetoResult = {
  id: string;
  nome: string;
};

export type BuscaTarefaResult = {
  id: string;
  titulo: string;
  trecho: string | null;
  /** Modelo de série recorrente (receita) — deve aparecer na Busca também para Visualizador. */
  serie_modelo?: boolean;
  recorrencia_pasta_id?: string | null;
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
  const tarefasRaw = asArray<BuscaTarefaResult>(payload.tarefas);
  const tarefaIds = tarefasRaw.map((t) => t.id);
  let tarefas = tarefasRaw;
  if (tarefaIds.length > 0) {
    const { data: meta } = await supabase
      .from("tarefas")
      .select("id, serie_raiz_id, recorrencia_pasta_id")
      .in("id", tarefaIds);
    const metaById = new Map(
      (meta ?? []).map((r) => [
        r.id,
        {
          serie_modelo: !!(r.serie_raiz_id && r.serie_raiz_id === r.id),
          recorrencia_pasta_id: r.recorrencia_pasta_id ?? null,
        },
      ]),
    );
    // Mantém modelos de série na Busca (Visualizador precisa achar a série pelo nome).
    // Filtros locais de Agenda (buscarTarefaIds) continuam excluindo modelos.
    tarefas = tarefasRaw.map((t) => {
      const info = metaById.get(t.id);
      return {
        ...t,
        serie_modelo: info?.serie_modelo ?? false,
        recorrencia_pasta_id: info?.recorrencia_pasta_id ?? null,
      };
    });
  }

  return {
    projetos: asArray<BuscaProjetoResult>(payload.projetos),
    tarefas,
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
  const ids = Array.isArray(data) ? (data as string[]) : [];
  if (ids.length === 0) return [];

  // Exclui modelos de série dos filtros locais de Agenda (Hoje / Em breve / Geral).
  // A Busca global (buscarConteudo) mantém os modelos para Visualizador achar a série.
  const { data: rows, error: metaError } = await supabase
    .from("tarefas")
    .select("id, serie_raiz_id")
    .in("id", ids)
    .is("deleted_at", null);
  if (metaError) throw metaError;

  return (rows ?? [])
    .filter((row) => !row.serie_raiz_id || row.serie_raiz_id !== row.id)
    .map((row) => row.id);
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

/** IDs de subtarefas para filtros locais (ex.: aba Hoje). */
export async function buscarSubtarefaIds(termo: string): Promise<string[]> {
  const trimmed = termo.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("buscar_subtarefa_ids", {
    p_termo: trimmed,
  });

  if (error) throw error;
  return Array.isArray(data) ? (data as string[]) : [];
}
