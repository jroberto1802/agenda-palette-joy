export type NotificacaoTipo =
  | "tarefa_atribuida"
  | "tarefa_comentario"
  | "tarefa_status"
  | "aviso_novo"
  | "sistema";

export const NOTIFICACAO_TIPO_LABELS: Record<NotificacaoTipo, string> = {
  tarefa_atribuida: "Tarefa atribuída",
  tarefa_comentario: "Novo comentário",
  tarefa_status: "Status alterado",
  aviso_novo: "Novo aviso",
  sistema: "Sistema",
};

export function getNotificacaoLink(
  notificacao: { referencia_tipo: string | null; referencia_id: string | null },
): string {
  if (notificacao.referencia_tipo === "tarefa" && notificacao.referencia_id) {
    return "/tarefas";
  }
  if (notificacao.referencia_tipo === "aviso" && notificacao.referencia_id) {
    return "/avisos";
  }
  return "/dashboard";
}

export function getNotificacaoMensagem(notificacao: {
  tipo: string;
  referencia_tipo: string | null;
}): string {
  const labels = NOTIFICACAO_TIPO_LABELS as Record<string, string>;
  return labels[notificacao.tipo] ?? "Nova notificação";
}
