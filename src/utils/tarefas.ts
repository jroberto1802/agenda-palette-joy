import type {
  Profile,
  SetorWithGerente,
  SubtarefaWithAuthors,
  TarefaLembreteOpcao,
  TarefaPrioridade,
  TarefaVisibilidade,
  TarefaWithRelations,
} from "@/types";
import type { TarefaClassificar } from "@/utils/agenda-classificar-preference";
import { toLocalDateKey } from "@/utils/agenda-datas";

/** Campos mínimos para ordenar a lista de subtarefas (pendentes acima). */
export type SubtarefaListOrderable = Pick<
  SubtarefaWithAuthors,
  "id" | "concluida" | "posicao" | "created_at"
>;

export const TAREFA_CONCLUIDA_LABELS: Record<"aberta" | "concluida", string> = {
  aberta: "Aberta",
  concluida: "Concluída",
};

export function getTarefaConclusaoLabel(concluida: boolean): string {
  return concluida ? TAREFA_CONCLUIDA_LABELS.concluida : TAREFA_CONCLUIDA_LABELS.aberta;
}

export const TAREFA_PRIORIDADE_LABELS: Record<TarefaPrioridade, string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P4: "P4",
};

/** Rank para ordenação P1 (maior) → P4 (menor). */
export const TAREFA_PRIORIDADE_RANK: Record<TarefaPrioridade, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};

export type ClassificavelPorAgenda = {
  prioridade: TarefaPrioridade;
  data_inicio: string | null;
  titulo: string;
};

export function compareByClassificar(
  a: ClassificavelPorAgenda,
  b: ClassificavelPorAgenda,
  mode: TarefaClassificar,
): number {
  if (mode === "prioridade") {
    const byPriority =
      TAREFA_PRIORIDADE_RANK[a.prioridade] - TAREFA_PRIORIDADE_RANK[b.prioridade];
    if (byPriority !== 0) return byPriority;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  }

  const dateA = toLocalDateKey(a.data_inicio);
  const dateB = toLocalDateKey(b.data_inicio);
  if (!dateA && !dateB) return a.titulo.localeCompare(b.titulo, "pt-BR");
  if (!dateA) return 1;
  if (!dateB) return -1;
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

export function sortByClassificar<T extends ClassificavelPorAgenda>(
  items: T[],
  mode: TarefaClassificar,
): T[] {
  return [...items].sort((a, b) => compareByClassificar(a, b, mode));
}

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

export const TAREFA_CONCLUIDA_COLORS: Record<"aberta" | "concluida", string> = {
  aberta: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  concluida: "bg-green-500/15 text-green-700 dark:text-green-400",
};

export function getTarefaConclusaoColorClass(concluida: boolean): string {
  return concluida ? TAREFA_CONCLUIDA_COLORS.concluida : TAREFA_CONCLUIDA_COLORS.aberta;
}

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

/** Janela, em minutos, em que usuário/gestor ainda podem reabrir uma tarefa concluída. Após esse prazo, somente Administrador. */
export const TAREFA_REABERTURA_JANELA_MINUTOS = 20;

/** Vínculo básico de edição (criador/responsável/gestor do setor), sem considerar se a tarefa está concluída. */
function temVinculoDeEdicaoTarefa(
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

/**
 * Edição de campos da tarefa (título, descrição, metadados, subtarefas, status).
 * Comentários e anexos usam `canCommentOrAttachTarefa` — visualizadores podem
 * interagir sem editar campos.
 * Tarefa concluída: edição de campos é sempre restrita ao Administrador, em qualquer
 * momento — mesmo dentro da janela de reabertura, usuário/gestor não editam campos.
 */
export function canEditTarefa(
  tarefa: TarefaWithRelations,
  userId: string | undefined,
  isAdminUser: boolean,
  isGerenteUser: boolean,
  userSetorId: string | null | undefined,
): boolean {
  if (tarefa.concluida) return isAdminUser;
  return temVinculoDeEdicaoTarefa(tarefa, userId, isAdminUser, isGerenteUser, userSetorId);
}

/**
 * Comentários e upload de anexos: quem tem acesso de leitura à tarefa/subtarefa
 * (incluindo Visualizadores via Visibilidade) pode interagir.
 * Não libera edição de campos, exclusão da tarefa nem conclusão — use
 * `canEditTarefa` / `canToggleTarefaConclusao` / delete na rota.
 * Exclusão de anexos permanece no padrão de quem edita (`canEdit`).
 */
export function canCommentOrAttachTarefa(
  tarefa: Pick<TarefaWithRelations, "id"> | null | undefined,
  userId: string | undefined,
  readOnly = false,
): boolean {
  if (readOnly || !userId || !tarefa) return false;
  return true;
}

/**
 * Reabertura de tarefa concluída (Concluída → Aberta):
 * - Administrador: pode reabrir a qualquer momento.
 * - Usuário/gestor com vínculo (criador/responsável/gestor do setor): só até
 *   `TAREFA_REABERTURA_JANELA_MINUTOS` minutos após `data_conclusao`.
 */
export function canReabrirTarefa(
  tarefa: TarefaWithRelations,
  userId: string | undefined,
  isAdminUser: boolean,
  isGerenteUser: boolean,
  userSetorId: string | null | undefined,
): boolean {
  if (!tarefa.concluida) return false;
  if (isAdminUser) return true;
  if (!temVinculoDeEdicaoTarefa(tarefa, userId, isAdminUser, isGerenteUser, userSetorId)) {
    return false;
  }
  if (!tarefa.data_conclusao) return false;
  const minutosDesdeConclusao = (Date.now() - new Date(tarefa.data_conclusao).getTime()) / 60000;
  return minutosDesdeConclusao <= TAREFA_REABERTURA_JANELA_MINUTOS;
}

/**
 * Permissão para acionar a bolinha de conclusão da tarefa: concluir (se aberta,
 * mesmo vínculo de `canEditTarefa`) ou reabrir (se concluída, ver `canReabrirTarefa`).
 */
export function canToggleTarefaConclusao(
  tarefa: TarefaWithRelations,
  userId: string | undefined,
  isAdminUser: boolean,
  isGerenteUser: boolean,
  userSetorId: string | null | undefined,
): boolean {
  if (tarefa.concluida) {
    return canReabrirTarefa(tarefa, userId, isAdminUser, isGerenteUser, userSetorId);
  }
  return temVinculoDeEdicaoTarefa(tarefa, userId, isAdminUser, isGerenteUser, userSetorId);
}

export function getTarefaResponsaveis(
  tarefa: TarefaWithRelations,
): Pick<Profile, "id" | "nome_completo" | "avatar_url" | "ativo">[] {
  if (tarefa.responsaveis?.length) {
    return tarefa.responsaveis
      .map((r) => r.usuario)
      .filter((u): u is Pick<Profile, "id" | "nome_completo" | "avatar_url" | "ativo"> => !!u);
  }
  if (tarefa.responsavel) return [tarefa.responsavel];
  return [];
}

/** Responsáveis + visualizadores (únicos) para avatares no card. */
export function getTarefaPessoasCard(
  tarefa: TarefaWithRelations,
): Pick<Profile, "id" | "nome_completo" | "avatar_url" | "ativo">[] {
  const seen = new Set<string>();
  const result: Pick<Profile, "id" | "nome_completo" | "avatar_url" | "ativo">[] = [];
  for (const pessoa of [
    ...getTarefaResponsaveis(tarefa),
    ...(tarefa.observadores ?? [])
      .map((o) => o.usuario)
      .filter((u): u is Pick<Profile, "id" | "nome_completo" | "avatar_url" | "ativo"> => !!u),
  ]) {
    if (seen.has(pessoa.id)) continue;
    seen.add(pessoa.id);
    result.push(pessoa);
  }
  return result;
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
  if (tarefa.concluida) return isAdminUser;
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
