const STORAGE_KEY_PREFIX = "coregestor.agenda.view";
/** Chave legada (global) — só usada para migração pontual; não escrever mais nela. */
const LEGACY_STORAGE_KEY = "coregestor.agenda.view";

export type AgendaViewMode = "cards" | "lista" | "colunas";

/** Escopos independentes por menu/tela. */
export type AgendaViewPreferenceScope =
  | "agenda-geral"
  | "agenda-visualizando"
  | "finalizados"
  | "equipe"
  | "projeto-detalhe";

export function normalizeAgendaViewMode(view: string | null | undefined): AgendaViewMode {
  if (view === "kanban" || view === "colunas") return "colunas";
  if (view === "lista") return "lista";
  return "cards";
}

function storageKey(userId: string, scope: AgendaViewPreferenceScope): string {
  return `${STORAGE_KEY_PREFIX}.${userId}.${scope}`;
}

/**
 * Lê a preferência do usuário para um menu.
 * Sem userId (ainda não autenticado): retorna "cards" (primeira utilização).
 */
export function readAgendaViewPreference(
  userId: string | null | undefined,
  scope: AgendaViewPreferenceScope,
): AgendaViewMode {
  if (typeof window === "undefined" || !userId) return "cards";
  try {
    const scoped = window.localStorage.getItem(storageKey(userId, scope));
    if (scoped != null) return normalizeAgendaViewMode(scoped);

    // Migração única só para Agenda Geral (chave global antiga).
    if (scope === "agenda-geral") {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy != null) {
        const migrated = normalizeAgendaViewMode(legacy);
        window.localStorage.setItem(storageKey(userId, scope), migrated);
        return migrated;
      }
    }

    return "cards";
  } catch {
    return "cards";
  }
}

/** Persiste a preferência do usuário para um menu específico. */
export function writeAgendaViewPreference(
  userId: string | null | undefined,
  scope: AgendaViewPreferenceScope,
  view: AgendaViewMode,
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId, scope), normalizeAgendaViewMode(view));
  } catch {
    // ignore quota / private mode
  }
}
