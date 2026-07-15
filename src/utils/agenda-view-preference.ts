const STORAGE_KEY = "coregestor.agenda.view";

export type AgendaViewMode = "cards" | "lista" | "colunas";

export function normalizeAgendaViewMode(view: string | null | undefined): AgendaViewMode {
  if (view === "kanban" || view === "colunas") return "colunas";
  if (view === "lista") return "lista";
  return "cards";
}

export function readAgendaViewPreference(): AgendaViewMode {
  if (typeof window === "undefined") return "cards";
  try {
    return normalizeAgendaViewMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "cards";
  }
}

export function writeAgendaViewPreference(view: AgendaViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalizeAgendaViewMode(view));
  } catch {
    // ignore quota / private mode
  }
}
