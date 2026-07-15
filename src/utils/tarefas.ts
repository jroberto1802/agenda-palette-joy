import type {
  Profile,
  SetorWithGerente,
  SubtarefaWithAuthors,
  TarefaLembreteOpcao,
  TarefaPrioridade,
  TarefaStatus,
  TarefaVisibilidade,
  TarefaWithRelations,
} from "@/types";

/** Campos mínimos para ordenar a lista de subtarefas (pendentes acima). */
export type SubtarefaListOrderable = Pick<
  SubtarefaWithAuthors,
  "id" | "concluida" | "posicao" | "created_at"
>;

export const KANBAN_COLUMNS: { id: TarefaStatus; label: string }[] = [
  { id: "a_fazer", label: "A fazer" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "cancelada", label: "Cancelada" },
  { id: "concluida", label: "Concluída" },
];

export const TAREFA_STATUS_LABELS: Record<TarefaStatus, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

export const TAREFA_PRIORIDADE_LABELS: Record<TarefaPrioridade, string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P4: "P4",
};

export const TAREFA_PRIORIDADE_COLORS: Record<TarefaPrioridade, string> = {
  P1: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  P2: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  P3: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  P4: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

export const TAREFA_PRIORIDADE_DOT: Record<TarefaPrioridade, string> = {
  P1: "bg-red-500",
  P2: "bg-orange-500",
  P3: "bg-amber-500",
  P4: "bg-slate-400",
};

/** Borda esquerda dos cards/linhas — mesma paleta do ponto de prioridade. */
export const TAREFA_PRIORIDADE_BAND_CLASS: Record<TarefaPrioridade, string> = {
  P1: "border-l-red-500",
  P2: "border-l-orange-500",
  P3: "border-l-amber-500",
  P4: "border-l-slate-400",
};

export const TAREFA_STATUS_COLORS: Record<TarefaStatus, string> = {
  a_fazer: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  cancelada: "bg-red-500/15 text-red-700 dark:text-red-400",
  concluida: "bg-green-500/15 text-green-700 dark:text-green-400",
};

export const TAREFA_VISIBILIDADE_LABELS: Record<TarefaVisibilidade, string> = {
  somente_para_mim: "Somente para mim",
  todos_empresa: "Todos",
  todos_setor: "Todos do setor",
  todos_projeto: "Todos do projeto",
  pessoas_especificas: "Pessoas específicas",
};

export const TAREFA_VISIBILIDADE_OPTIONS = Object.keys(
  TAREFA_VISIBILIDADE_LABELS,
) as TarefaVisibilidade[];

export const TAREFA_LEMBRETE_LABELS: Record<TarefaLembreteOpcao, string> = {
  no_prazo: "Na data",
  "1h_antes": "1 hora antes",
  "1d_antes": "1 dia antes",
  "1sem_antes": "1 semana antes",
};

export function getSetoresPermitidos(
  setores: SetorWithGerente[],
  profile: Profile | null | undefined,
  isAdminUser: boolean,
  isGerenteUser: boolean,
): SetorWithGerente[] {
  if (isAdminUser || isGerenteUser) return setores;
  if (!profile?.setor_id) return [];
  return setores.filter((s) => s.id === profile.setor_id);
}

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
  if (tarefa.responsaveis?.some((r) => r.usuario_id === userId)) return true;
  if (isGerenteUser && tarefa.setor_id && tarefa.setor_id === userSetorId) return true;
  return false;
}

export function getTarefaResponsaveis(
  tarefa: TarefaWithRelations,
): Pick<Profile, "id" | "nome_completo" | "avatar_url">[] {
  if (tarefa.responsaveis?.length) {
    return tarefa.responsaveis
      .map((r) => r.usuario)
      .filter((u): u is Pick<Profile, "id" | "nome_completo" | "avatar_url"> => !!u);
  }
  if (tarefa.responsavel) return [tarefa.responsavel];
  return [];
}

export function formatResponsaveisLabel(tarefa: TarefaWithRelations): string {
  const nomes = getTarefaResponsaveis(tarefa).map((r) => r.nome_completo);
  if (nomes.length === 0) return "Sem responsável";
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes[0]} +${nomes.length - 1}`;
}

export function canEditVisibilidade(
  tarefa: TarefaWithRelations | null | undefined,
  userId: string | undefined,
  isAdminUser: boolean,
  isGerenteUser: boolean,
  userSetorId: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (!tarefa) return true;
  if (isAdminUser) return true;
  if (tarefa.criado_por === userId) return true;
  if (isGerenteUser && tarefa.setor_id && tarefa.setor_id === userSetorId) return true;
  return false;
}

export function parseLembretes(value: unknown): TarefaLembreteOpcao[] {
  if (!Array.isArray(value)) return [];
  const allowed: TarefaLembreteOpcao[] = ["no_prazo", "1h_antes", "1d_antes", "1sem_antes"];
  return value.filter((item): item is TarefaLembreteOpcao => allowed.includes(item as TarefaLembreteOpcao));
}

/**
 * Ordena subtarefas: pendentes primeiro (por `posicao` / criação),
 * concluídas no final (mesma ordem relativa entre si).
 * Usa apenas `concluida` (checkbox), independente de status Cancelada.
 */
export function compareSubtarefasListOrder(
  a: SubtarefaListOrderable,
  b: SubtarefaListOrderable,
): number {
  const concluidaDiff = Number(a.concluida) - Number(b.concluida);
  if (concluidaDiff !== 0) return concluidaDiff;
  const pa = a.posicao ?? 0;
  const pb = b.posicao ?? 0;
  if (pa !== pb) return pa - pb;
  return a.created_at.localeCompare(b.created_at);
}

export function sortSubtarefasList<T extends SubtarefaListOrderable>(items: T[]): T[] {
  return [...items].sort(compareSubtarefasListOrder);
}

/**
 * Após um drag livre, reagrupa: pendentes na ordem relativa do array,
 * depois concluídas — para não misturar grupos.
 */
export function partitionSubtarefaIdsByConclusao(
  orderedIds: string[],
  byId: Map<string, Pick<SubtarefaListOrderable, "concluida">>,
): string[] {
  const pending: string[] = [];
  const done: string[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (!item) continue;
    if (item.concluida) done.push(id);
    else pending.push(id);
  }
  return [...pending, ...done];
}
