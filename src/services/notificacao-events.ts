import { supabase } from "@/integrations/supabase/client";
import { notifyUsers } from "@/services/notificacoes";
import type { NotificacaoMeta, NotificacaoTipo } from "@/utils/notificacoes";
import { extractMentionedUserIds } from "@/utils/notificacoes";
import { TAREFA_PRIORIDADE_LABELS, TAREFA_STATUS_LABELS } from "@/utils/tarefas";
import type { TarefaPrioridade, TarefaStatus } from "@/types";

export async function getCurrentActor(): Promise<{ id: string; nome: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome_completo")
    .eq("id", user.id)
    .single();

  if (!profile) return { id: user.id, nome: "Alguém" };
  return { id: profile.id, nome: profile.nome_completo || "Alguém" };
}

export async function getTarefaStakeholderIds(tarefaId: string): Promise<string[]> {
  const [{ data: tarefa }, { data: responsaveis }] = await Promise.all([
    supabase.from("tarefas").select("criado_por").eq("id", tarefaId).single(),
    supabase.from("tarefa_responsaveis").select("usuario_id").eq("tarefa_id", tarefaId),
  ]);

  return [
    ...new Set(
      [tarefa?.criado_por, ...(responsaveis ?? []).map((r) => r.usuario_id)].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
}

async function notifyEvent(params: {
  usuarioIds: string[];
  tipo: NotificacaoTipo;
  mensagem: string;
  referencia_tipo: "tarefa" | "aviso";
  referencia_id: string;
  meta?: NotificacaoMeta;
}) {
  await notifyUsers(params.usuarioIds, {
    tipo: params.tipo,
    mensagem: params.mensagem,
    referencia_tipo: params.referencia_tipo,
    referencia_id: params.referencia_id,
    meta: params.meta ?? {},
  });
}

export async function notifyTarefaAtribuida(params: {
  usuarioIds: string[];
  tarefaId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_atribuida",
    mensagem: `${params.atorNome} atribuiu uma tarefa para você`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaConcluida(params: {
  usuarioIds: string[];
  tarefaId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_concluida",
    mensagem: `${params.atorNome} marcou sua tarefa como concluída`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaStatus(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  status: TarefaStatus;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_status",
    mensagem: `${params.atorNome} alterou o status da tarefa ${params.titulo} para ${TAREFA_STATUS_LABELS[params.status]}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaPrioridade(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  prioridade: TarefaPrioridade;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_prioridade",
    mensagem: `${params.atorNome} alterou a prioridade da tarefa ${params.titulo} para ${TAREFA_PRIORIDADE_LABELS[params.prioridade]}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaResponsavel(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_responsavel",
    mensagem: `${params.atorNome} alterou o responsável da tarefa ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaPrazo(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_prazo",
    mensagem: `${params.atorNome} alterou o prazo da tarefa ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaMovida(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  destino: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_movida",
    mensagem: `${params.atorNome} moveu a tarefa ${params.titulo} para ${params.destino}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaSubtarefa(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_subtarefa",
    mensagem: `${params.atorNome} adicionou uma subtarefa em ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaSubtarefaConcluida(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_subtarefa_concluida",
    mensagem: `${params.atorNome} concluiu uma subtarefa em ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
  });
}

export async function notifyTarefaAnexo(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_anexo",
    mensagem: `${params.atorNome} enviou um anexo na tarefa ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
    meta: { aba: "anexos" },
  });
}

export async function notifyTarefaComentario(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  comentarioId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_comentario",
    mensagem: `${params.atorNome} comentou na tarefa ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
    meta: { aba: "comentarios", comentario_id: params.comentarioId },
  });
}

export async function notifyTarefaMencao(params: {
  usuarioIds: string[];
  tarefaId: string;
  comentarioId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_mencao",
    mensagem: `${params.atorNome} mencionou você em um comentário`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
    meta: { aba: "comentarios", comentario_id: params.comentarioId },
  });
}

export async function notifyAvisoNovo(params: {
  usuarioIds: string[];
  avisoId: string;
  titulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "aviso_novo",
    mensagem: `${params.atorNome} publicou um novo aviso: ${params.titulo}`,
    referencia_tipo: "aviso",
    referencia_id: params.avisoId,
  });
}

export async function notifyAvisoComentario(params: {
  usuarioIds: string[];
  avisoId: string;
  titulo: string;
  comentarioId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "aviso_comentario",
    mensagem: `${params.atorNome} comentou no aviso ${params.titulo}`,
    referencia_tipo: "aviso",
    referencia_id: params.avisoId,
    meta: { comentario_id: params.comentarioId },
  });
}

export async function notifyAvisoMencao(params: {
  usuarioIds: string[];
  avisoId: string;
  titulo: string;
  comentarioId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "aviso_mencao",
    mensagem: `${params.atorNome} mencionou você em um comentário no aviso ${params.titulo}`,
    referencia_tipo: "aviso",
    referencia_id: params.avisoId,
    meta: { comentario_id: params.comentarioId },
  });
}

export async function resolveMentionIds(conteudo: string): Promise<string[]> {
  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome_completo")
    .eq("ativo", true);

  return extractMentionedUserIds(conteudo, pessoas ?? []);
}

export async function resolveDestinoLabel(params: {
  setorId: string | null;
  projetoId: string | null;
}): Promise<string | null> {
  const parts: string[] = [];

  if (params.projetoId) {
    const { data } = await supabase
      .from("projetos")
      .select("nome")
      .eq("id", params.projetoId)
      .single();
    if (data?.nome) parts.push(data.nome);
  }

  if (params.setorId) {
    const { data } = await supabase
      .from("setores")
      .select("nome")
      .eq("id", params.setorId)
      .single();
    if (data?.nome) parts.push(data.nome);
  }

  return parts.length ? parts.join(" / ") : null;
}
