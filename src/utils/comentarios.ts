import type { Papel, Profile } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";

/** Janela (ms) em que usuário comum pode editar/excluir o próprio comentário. */
export const COMENTARIO_EDIT_WINDOW_MS = 20 * 60 * 1000;

export type ComentarioAutorMini = {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
  papel?: Papel | null;
};

export type ComentarioMutavel = {
  id: string;
  created_at: string;
  usuario_id: string | null;
  usuario?: ComentarioAutorMini | null;
  editado_em?: string | null;
  editado_por?: string | null;
  editor?: ComentarioAutorMini | null;
};

function isPrivilegedPapel(papel: Papel | null | undefined): boolean {
  return papel === "admin" || papel === "gerente";
}

function withinEditWindow(createdAt: string, nowMs = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return nowMs - created <= COMENTARIO_EDIT_WINDOW_MS;
}

/**
 * Regras de edição/exclusão de comentários (tarefa/subtarefa).
 * - Usuário comum: só o próprio, até 20 minutos
 * - Gestor: próprios + de usuários comuns, sem limite de tempo; não toca gestor/admin
 * - Admin: qualquer comentário, a qualquer momento
 */
export function canMutateComentario(
  profile: Profile | null | undefined,
  comentario: Pick<ComentarioMutavel, "created_at" | "usuario_id" | "usuario">,
  nowMs = Date.now(),
): boolean {
  if (!profile?.id) return false;
  if (isAdmin(profile)) return true;

  const isOwn = comentario.usuario_id === profile.id;
  const autorPapel =
    comentario.usuario?.papel ??
    (isOwn ? profile.papel : null);

  if (isGerente(profile)) {
    if (isOwn) return true;
    return !isPrivilegedPapel(autorPapel);
  }

  // Usuário comum (e demais papéis não privilegiados)
  if (!isOwn) return false;
  return withinEditWindow(comentario.created_at, nowMs);
}

/** Label de edição exibida junto ao comentário. */
export function getComentarioEditadoLabel(
  comentario: Pick<ComentarioMutavel, "editado_em" | "editado_por" | "usuario_id" | "editor">,
): string | null {
  if (!comentario.editado_em) return null;
  if (comentario.editado_por && comentario.editado_por !== comentario.usuario_id) {
    const nome = comentario.editor?.nome_completo?.trim();
    return nome ? `editado por ${nome}` : "editado por outra pessoa";
  }
  return "(editado)";
}
