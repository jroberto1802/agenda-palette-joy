export type NotificacaoTipo =
  | "tarefa_atribuida"
  | "tarefa_concluida"
  | "tarefa_status"
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
  | "aviso_novo"
  | "aviso_comentario"
  | "aviso_mencao"
  | "aviso_resposta"
  | "sistema";

export type NotificacaoAba = "comentarios" | "anexos";

export type NotificacaoMeta = {
  comentario_id?: string;
  aba?: NotificacaoAba;
};

export const NOTIFICACAO_TIPO_LABELS: Record<NotificacaoTipo, string> = {
  tarefa_atribuida: "Tarefa atribuída",
  tarefa_concluida: "Tarefa concluída",
  tarefa_status: "Status alterado",
  tarefa_prioridade: "Prioridade alterada",
  tarefa_responsavel: "Responsável alterado",
  tarefa_prazo: "Prazo alterado",
  tarefa_movida: "Tarefa movida",
  tarefa_subtarefa: "Nova subtarefa",
  tarefa_subtarefa_concluida: "Subtarefa concluída",
  tarefa_anexo: "Novo anexo",
  tarefa_comentario: "Novo comentário",
  tarefa_mencao: "Menção em comentário",
  tarefa_resposta: "Resposta ao seu comentário",
  aviso_novo: "Novo aviso",
  aviso_comentario: "Comentário em aviso",
  aviso_mencao: "Menção em aviso",
  aviso_resposta: "Resposta ao seu comentário",
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

export function parseNotificacaoMeta(meta: unknown): NotificacaoMeta {
  if (!meta || typeof meta !== "object") return {};
  const value = meta as Record<string, unknown>;
  const result: NotificacaoMeta = {};
  if (typeof value.comentario_id === "string") result.comentario_id = value.comentario_id;
  if (value.aba === "comentarios" || value.aba === "anexos") result.aba = value.aba;
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
  if (!conteudo.includes("@") || pessoas.length === 0) return [];

  const sorted = [...pessoas].sort(
    (a, b) => b.nome_completo.length - a.nome_completo.length,
  );
  const mentioned = new Set<string>();
  const lower = conteudo.toLowerCase();

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