import type { ProjetoStatus, TarefaStatus } from "@/types";

/** Status que bloqueiam exclusão simples e contam como atividades abertas. */
export const PROJETO_OPEN_ACTIVITY_STATUSES: TarefaStatus[] = ["a_fazer", "em_andamento"];

export function isProjetoOpenActivityStatus(status: string | null | undefined): boolean {
  return status === "a_fazer" || status === "em_andamento";
}

export const PROJETO_STATUS_LABELS: Record<ProjetoStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const PROJETO_STATUS_BADGE_CLASS: Record<ProjetoStatus, string> = {
  nao_iniciado: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  concluido: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};
