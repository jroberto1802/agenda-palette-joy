export type NotificacaoTipo =
  | "tarefa_atribuida"
  | "tarefa_visualizador"
  | "tarefa_concluida"
  | "tarefa_prioridade"
  | "tarefa_responsavel"
  | "tarefa_prazo"
  | "tarefa_movida"
  | "tarefa_subtarefa"
  | "tarefa_subtarefa_concluida"
  | "tarefa_anexo"
  | "tarefa_comentario"
  | "tarefa_mencao"
  | "tarefa_resposta"
  | "tarefa_comentario_reacao"
  | "aviso_novo"
  | "aviso_comentario"
  | "aviso_mencao"
  | "aviso_resposta"
  | "aviso_comentario_reacao"
  | "sistema";

export type NotificacaoAba = "comentarios" | "anexos";

export type NotificacaoMeta = {
  comentario_id?: string;
  aba?: NotificacaoAba;
  subtarefa_id?: string;
};

export const NOTIFICACAO_TIPO_LABELS: Record<NotificacaoTipo, string> = {
  tarefa_atribuida: "Tarefa atribuída",
  tarefa_visualizador: "Adicionado como visualizador",
  tarefa_concluida: "Tarefa concluída",
  tarefa_prioridade: "Prioridade alterada",
  tarefa_responsavel: "Responsável alterado",
  tarefa_prazo: "Data alterada",
  tarefa_movida: "Tarefa movida",
  tarefa_subtarefa: "Nova subtarefa",
  tarefa_subtarefa_concluida: "Subtarefa concluída",
  tarefa_anexo: "Novo anexo",
  tarefa_comentario: "Novo comentário",
  tarefa_mencao: "Menção em comentário",
  tarefa_resposta: "Resposta ao seu comentário",
  tarefa_comentario_reacao: "Reação ao seu comentário",
  aviso_novo: "Novo aviso",
  aviso_comentario: "Comentário em aviso",
  aviso_mencao: "Menção em aviso",
  aviso_resposta: "Resposta ao seu comentário",
  aviso_comentario_reacao: "Reação ao seu comentário",
  sistema: "Sistema",
};

export function getNotificacaoMensagem(notificacao: {
  tipo: string;
  mensagem?: string | null;
}): string {
  if (notificacao.mensagem?.trim()) return notificacao.mensagem.trim();
  const labels = NOTIFICACAO_TIPO_LABELS as Record<string, string>;
  return labels[notificacao.tipo] ?? "Nova notificação";
}

/** Ícone Lucide sugerido por tipo de notificação (nome semântico para a UI). */
export function getNotificacaoIconKind(
  tipo: string | null | undefined,
): "tarefa" | "aviso" | "comentario" | "anexo" | "sistema" {
  if (!tipo || typeof tipo !== "string") return "sistema";
  if (tipo.startsWith("aviso_")) return "aviso";
  if (tipo.includes("comentario") || tipo.includes("mencao") || tipo.includes("resposta") || tipo.includes("reacao")) {
    return "comentario";
  }
  if (tipo.includes("anexo")) return "anexo";
  if (tipo === "sistema") return "sistema";
  return "tarefa";
}

export const OPEN_NOTIFICATIONS_EVENT = "coregestor:open-notifications";

export function openNotificationsPanel() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT));
}

export function parseNotificacaoMeta(meta: unknown): NotificacaoMeta {
  if (!meta || typeof meta !== "object") return {};
  const value = meta as Record<string, unknown>;
  const result: NotificacaoMeta = {};
  if (typeof value.comentario_id === "string") result.comentario_id = value.comentario_id;
  if (value.aba === "comentarios" || value.aba === "anexos") result.aba = value.aba;
  if (typeof value.subtarefa_id === "string") result.subtarefa_id = value.subtarefa_id;
  return result;
}

export function getNotificacaoNavigateTarget(notificacao: {
  referencia_tipo: string | null;
  referencia_id: string | null;
  meta?: unknown;
}): {
  to: "/tarefas" | "/avisos" | "/dashboard";
  search?: {
    tarefaId?: string;
    avisoId?: string;
    aba?: NotificacaoAba;
    comentarioId?: string;
    subtarefaId?: string;
  };
} {
  const meta = parseNotificacaoMeta(notificacao.meta);

  if (notificacao.referencia_tipo === "tarefa" && notificacao.referencia_id) {
    return {
      to: "/tarefas",
      search: {
        tarefaId: notificacao.referencia_id,
        ...(meta.aba ? { aba: meta.aba } : {}),
        ...(meta.comentario_id ? { comentarioId: meta.comentario_id } : {}),
        ...(meta.subtarefa_id ? { subtarefaId: meta.subtarefa_id } : {}),
      },
    };
  }

  if (notificacao.referencia_tipo === "aviso" && notificacao.referencia_id) {
    return {
      to: "/avisos",
      search: {
        avisoId: notificacao.referencia_id,
        ...(meta.comentario_id ? { comentarioId: meta.comentario_id } : {}),
      },
    };
  }

  return { to: "/dashboard" };
}

/** Compat: links antigos sem search. */
export function getNotificacaoLink(notificacao: {
  referencia_tipo: string | null;
  referencia_id: string | null;
  meta?: unknown;
}): string {
  return getNotificacaoNavigateTarget(notificacao).to;
}

export function extractMentionedUserIds(
  conteudo: string,
  pessoas: { id: string; nome_completo: string }[],
): string[] {
  // Conteúdo pode ser HTML rico — menções continuam como @Nome no texto
  const plain = conteudo.replace(/<[^>]+>/g, " ");
  if (!plain.includes("@") || pessoas.length === 0) return [];

  const sorted = [...pessoas].sort(
    (a, b) => b.nome_completo.length - a.nome_completo.length,
  );
  const mentioned = new Set<string>();
  const lower = plain.toLowerCase();

  for (const pessoa of sorted) {
    const nome = pessoa.nome_completo.trim();
    if (!nome) continue;
    const fullNeedle = `@${nome}`.toLowerCase();
    if (lower.includes(fullNeedle)) {
      mentioned.add(pessoa.id);
      continue;
    }
    const primeiro = nome.split(/\s+/)[0];
    if (primeiro && primeiro.length >= 3) {
      const firstNeedle = `@${primeiro}`.toLowerCase();
      const idx = lower.indexOf(firstNeedle);
      if (idx >= 0) {
        const after = lower[idx + firstNeedle.length] ?? " ";
        if (!/[a-z0-9_]/.test(after)) {
          mentioned.add(pessoa.id);
        }
      }
    }
  }

  return [...mentioned];
}

/**
 * Bloqueia @ de pessoas fora da lista permitida (mesmo se digitadas manualmente).
 * Compara menções resolvidas contra todos os perfis ativos vs. candidatos do escopo.
 */
export function assertMentionsDentroDoEscopo(
  conteudo: string,
  permitidos: { id: string; nome_completo: string }[],
  todosAtivos: { id: string; nome_completo: string }[],
  mensagem: string,
): void {
  if (!conteudo.includes("@")) return;
  const mencionados = extractMentionedUserIds(conteudo, todosAtivos);
  if (mencionados.length === 0) return;
  const allowed = new Set(permitidos.map((p) => p.id));
  if (mencionados.some((id) => !allowed.has(id))) {
    throw new Error(mensagem);
  }
}