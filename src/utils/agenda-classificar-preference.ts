const STORAGE_KEY_PREFIX = "coregestor.agenda.classificar";

export type TarefaClassificar = "prioridade" | "data_asc";

/** Escopos independentes por menu/tela (mesmo padrão da preferência de visualização). */
export type AgendaClassificarScope =
  | "agenda-hoje"
  | "agenda-em-breve"
  | "agenda-geral"
  | "agenda-visualizando"
  | "equipe"
  | "projeto-detalhe";

export const TAREFA_CLASSIFICAR_LABELS: Record<TarefaClassificar, string> = {
  prioridade: "Por Prioridade",
  data_asc: "Por Data (ordem crescente)",
};

export function normalizeTarefaClassificar(
  value: string | null | undefined,
): TarefaClassificar {
  if (value === "data_asc") return "data_asc";
  return "prioridade";
}

function storageKey(userId: string, scope: AgendaClassificarScope): string {
  return `${STORAGE_KEY_PREFIX}.${userId}.${scope}`;
}

/** Sem userId: padrão "Por Prioridade". */
export function readAgendaClassificarPreference(
  userId: string | null | undefined,
  scope: AgendaClassificarScope,
): TarefaClassificar {
  if (typeof window === "undefined" || !userId) return "prioridade";
  try {
    const raw = window.localStorage.getItem(storageKey(userId, scope));
    return normalizeTarefaClassificar(raw);
  } catch {
    return "prioridade";
  }
}

export function writeAgendaClassificarPreference(
  userId: string | null | undefined,
  scope: AgendaClassificarScope,
  value: TarefaClassificar,
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(
      storageKey(userId, scope),
      normalizeTarefaClassificar(value),
    );
  } catch {
    // ignore quota / private mode
  }
}
