import type { Profile, TarefaVisibilidade } from "@/types";

type PessoaId = string;

type EscopoTarefaInput = {
  criado_por?: string | null;
  atribuido_a?: string | null;
  responsaveis?: { usuario_id: string }[] | null;
  observadores?: { usuario_id: string }[] | null;
};

type EscopoSubtarefaInput = {
  criado_por?: string | null;
  atribuido_ids?: string[] | null;
  responsaveis?: { usuario_id: string }[] | null;
  observadores?: { usuario_id: string }[] | null;
  visibilidade?: TarefaVisibilidade | null;
};

/** Escopo da tarefa: criador + responsáveis + visibilidade (observadores). */
export function getTarefaEscopoIds(tarefa: EscopoTarefaInput): string[] {
  const ids = new Set<PessoaId>();
  if (tarefa.criado_por) ids.add(tarefa.criado_por);
  if (tarefa.atribuido_a) ids.add(tarefa.atribuido_a);
  for (const r of tarefa.responsaveis ?? []) {
    if (r.usuario_id) ids.add(r.usuario_id);
  }
  for (const o of tarefa.observadores ?? []) {
    if (o.usuario_id) ids.add(o.usuario_id);
  }
  return [...ids];
}

/**
 * Escopo da subtarefa: criador + responsáveis + pessoas da visibilidade.
 * Sempre deve ser subconjunto do escopo da tarefa pai.
 */
export function getSubtarefaEscopoIds(subtarefa: EscopoSubtarefaInput): string[] {
  const ids = new Set<PessoaId>();
  if (subtarefa.criado_por) ids.add(subtarefa.criado_por);
  for (const id of subtarefa.atribuido_ids ?? []) {
    if (id) ids.add(id);
  }
  for (const r of subtarefa.responsaveis ?? []) {
    if (r.usuario_id) ids.add(r.usuario_id);
  }
  for (const o of subtarefa.observadores ?? []) {
    if (o.usuario_id) ids.add(o.usuario_id);
  }
  return [...ids];
}

/** Intersecta lista de pessoas com IDs do escopo. */
export function filterPessoasPorEscopo<T extends Pick<Profile, "id">>(
  pessoas: T[],
  escopoIds: string[],
): T[] {
  if (escopoIds.length === 0) return [];
  const set = new Set(escopoIds);
  return pessoas.filter((p) => set.has(p.id));
}

/**
 * Usuário pode ver a subtarefa (agenda / lista) se estiver no escopo dela.
 * Admin deve ser tratado à parte na chamada.
 */
export function usuarioNoEscopoSubtarefa(
  usuarioId: string,
  subtarefa: EscopoSubtarefaInput,
): boolean {
  return getSubtarefaEscopoIds(subtarefa).includes(usuarioId);
}

export const MENCAO_FORA_DO_ESCOPO_MSG =
  "Não é possível mencionar este usuário porque ele não possui acesso a este item.";

export const ESCOPO_EXTERNO_MSG =
  "Não é possível selecionar usuários que não pertencem ao escopo da tarefa.";

/** Novo modelo: Visibilidade = lista de pessoas (persistida como pessoas_especificas). */
export const VISIBILIDADE_PESSOAS: TarefaVisibilidade = "pessoas_especificas";

/** Garante que todos os IDs estão no escopo permitido. */
export function assertIdsNoEscopo(ids: string[], escopoIds: string[], message = ESCOPO_EXTERNO_MSG): void {
  if (ids.length === 0) return;
  const set = new Set(escopoIds);
  if (ids.some((id) => id && !set.has(id))) {
    throw new Error(message);
  }
}
