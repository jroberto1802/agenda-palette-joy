import type {
  TarefaPrioridade,
  TarefaStatus,
  TarefaWithRelations,
} from "@/types";

export const KANBAN_COLUMNS: { id: TarefaStatus; label: string }[] = [
  { id: "a_fazer", label: "A fazer" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "bloqueada", label: "Bloqueada" },
  { id: "concluida", label: "Concluída" },
];

export const TAREFA_STATUS_LABELS: Record<TarefaStatus, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  bloqueada: "Bloqueada",
  concluida: "Concluída",
};

export const TAREFA_PRIORIDADE_LABELS: Record<TarefaPrioridade, string> = {
  P1: "P1 — Urgente",
  P2: "P2 — Alta",
  P3: "P3 — Média",
  P4: "P4 — Baixa",
};

export const TAREFA_PRIORIDADE_COLORS: Record<TarefaPrioridade, string> = {
  P1: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  P2: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  P3: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  P4: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

export const TAREFA_STATUS_COLORS: Record<TarefaStatus, string> = {
  a_fazer: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  bloqueada: "bg-red-500/15 text-red-700 dark:text-red-400",
  concluida: "bg-green-500/15 text-green-700 dark:text-green-400",
};

export function canEditTarefa(
  tarefa: TarefaWithRelations,
  userId: string | undefined,
  isAdminUser: boolean,
  isGerenteUser: boolean,
  userSetorId: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (isAdminUser) return true;
  if (tarefa.criado_por === userId || tarefa.atribuido_a === userId) return true;
  if (isGerenteUser && tarefa.setor_id && tarefa.setor_id === userSetorId) return true;
  return false;
}
