const STORAGE_KEY_PREFIX = "coregestor.agenda.classificar";

/**
 * Modos de classificação da agenda.
 * - prioridade: P1→P4 (sem ordenar por hora) — Agenda Geral / Visualizando / etc.
 * - prioridade_hora: P1→P4 e, dentro de cada prioridade, hora crescente (padrão Hoje / Em breve)
 * - hora: hora crescente; prioridade como desempate; sem hora ao final
 * - data_asc: data crescente (Agenda Geral)
 */
export type TarefaClassificar = "prioridade" | "prioridade_hora" | "hora" | "data_asc";

/** Escopos independentes por menu/tela (mesmo padrão da preferência de visualização). */
export type AgendaClassificarScope =
  | "agenda-hoje"
  | "agenda-em-breve"
  | "agenda-geral"
  | "agenda-visualizando"
  | "equipe"
  | "projeto-detalhe"
  | "recorrentes-pasta";

const HOJE_EM_BREVE_SCOPES: ReadonlySet<AgendaClassificarScope> = new Set([
  "agenda-hoje",
  "agenda-em-breve",
]);

export function isHojeOuEmBreveScope(scope: AgendaClassificarScope): boolean {
  return HOJE_EM_BREVE_SCOPES.has(scope);
}

export const TAREFA_CLASSIFICAR_LABELS: Record<TarefaClassificar, string> = {
  prioridade: "Por Prioridade",
  /** Em Hoje/Em breve: P1–P4 + hora (padrão). Rótulo de UI = "Por Prioridade". */
  prioridade_hora: "Por Prioridade",
  hora: "Por Hora",
  data_asc: "Por Data (ordem crescente)",
};

/** Tooltip / descrição auxiliar no seletor. */
export const TAREFA_CLASSIFICAR_HINTS: Partial<Record<TarefaClassificar, string>> = {
  hora: "Ordena por hora; prioridade desempata. Sem hora ao final.",
  prioridade_hora:
    "Padrão: agrupa por prioridade (P1–P4) e ordena por hora dentro de cada uma.",
  prioridade: "Ordena apenas por prioridade (P1 a P4).",
};

/**
 * Opções do filtro Classificar em Hoje e Em breve.
 * Por Prioridade = prioridade + hora (padrão); Por Hora = hora + prioridade.
 */
export const CLASSIFICAR_OPTIONS_HOJE_EM_BREVE: TarefaClassificar[] = [
  "prioridade_hora",
  "hora",
];

/** Opções do filtro Classificar na Agenda Geral (e similares). */
export const CLASSIFICAR_OPTIONS_GERAL: TarefaClassificar[] = [
  "prioridade",
  "data_asc",
];

export function defaultClassificarForScope(
  scope: AgendaClassificarScope,
): TarefaClassificar {
  return isHojeOuEmBreveScope(scope) ? "prioridade_hora" : "prioridade";
}

export function normalizeTarefaClassificar(
  value: string | null | undefined,
  scope?: AgendaClassificarScope,
): TarefaClassificar {
  if (value === "data_asc") return "data_asc";
  if (value === "hora") return "hora";
  if (value === "prioridade_hora") return "prioridade_hora";
  if (value === "prioridade") {
    // Preferência antiga "prioridade" em Hoje/Em breve → padrão novo (prioridade + hora).
    if (scope && isHojeOuEmBreveScope(scope)) return "prioridade_hora";
    return "prioridade";
  }
  return defaultClassificarForScope(scope ?? "agenda-geral");
}

function storageKey(userId: string, scope: AgendaClassificarScope): string {
  return `${STORAGE_KEY_PREFIX}.${userId}.${scope}`;
}

/** Sem userId: padrão do escopo (Hoje/Em breve = prioridade + hora). */
export function readAgendaClassificarPreference(
  userId: string | null | undefined,
  scope: AgendaClassificarScope,
): TarefaClassificar {
  const fallback = defaultClassificarForScope(scope);
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, scope));
    if (raw == null) {
      // Primeira visita: grava o padrão do escopo (Prioridade + Hora em Hoje/Em breve).
      writeAgendaClassificarPreference(userId, scope, fallback);
      return fallback;
    }
    return normalizeTarefaClassificar(raw, scope);
  } catch {
    return fallback;
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
      normalizeTarefaClassificar(value, scope),
    );
  } catch {
    // ignore quota / private mode
  }
}
