import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentActor,
  notifyAvisoComentarioReacao,
  notifySubtarefaComentarioReacao,
  notifyTarefaComentarioReacao,
} from "@/services/notificacao-events";

export type ComentarioReacaoEscopo = "tarefa" | "subtarefa" | "aviso";

const TABLE_BY_ESCOPO = {
  tarefa: "tarefa_comentario_reacoes",
  subtarefa: "subtarefa_comentario_reacoes",
  aviso: "aviso_comentario_reacoes",
} as const;

/**
 * Alterna reação (check) no comentário.
 * Retorna `true` se a reação ficou ativa após o toggle.
 */
export async function toggleComentarioReacao(
  escopo: ComentarioReacaoEscopo,
  comentarioId: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const table = TABLE_BY_ESCOPO[escopo];

  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("comentario_id")
    .eq("comentario_id", comentarioId)
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("comentario_id", comentarioId)
      .eq("usuario_id", user.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from(table).insert({
    comentario_id: comentarioId,
    usuario_id: user.id,
  });
  if (error) throw error;

  const ator = await getCurrentActor();
  const atorNome = ator?.nome ?? "Alguém";

  if (escopo === "tarefa") {
    await notifyTarefaReactionIfNeeded(comentarioId, user.id, atorNome).catch(() => undefined);
  } else if (escopo === "subtarefa") {
    await notifySubtarefaReactionIfNeeded(comentarioId, user.id, atorNome).catch(() => undefined);
  } else {
    await notifyAvisoReactionIfNeeded(comentarioId, user.id, atorNome).catch(() => undefined);
  }

  return true;
}

async function notifyTarefaReactionIfNeeded(
  comentarioId: string,
  reactorId: string,
  atorNome: string,
) {
  const { data: comentario } = await supabase
    .from("tarefa_comentarios")
    .select("usuario_id, tarefa_id")
    .eq("id", comentarioId)
    .single();
  if (!comentario?.usuario_id || comentario.usuario_id === reactorId) return;

  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("titulo")
    .eq("id", comentario.tarefa_id)
    .single();

  await notifyTarefaComentarioReacao({
    usuarioIds: [comentario.usuario_id],
    tarefaId: comentario.tarefa_id,
    titulo: tarefa?.titulo?.trim() || "tarefa",
    comentarioId,
    atorNome,
  });
}

async function notifySubtarefaReactionIfNeeded(
  comentarioId: string,
  reactorId: string,
  atorNome: string,
) {
  const { data: comentario } = await supabase
    .from("subtarefa_comentarios")
    .select("usuario_id, subtarefa_id")
    .eq("id", comentarioId)
    .single();
  if (!comentario?.usuario_id || comentario.usuario_id === reactorId) return;

  const { data: subtarefa } = await supabase
    .from("subtarefas")
    .select("titulo, tarefa_id")
    .eq("id", comentario.subtarefa_id)
    .single();
  if (!subtarefa?.tarefa_id) return;

  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("titulo")
    .eq("id", subtarefa.tarefa_id)
    .single();

  await notifySubtarefaComentarioReacao({
    usuarioIds: [comentario.usuario_id],
    tarefaId: subtarefa.tarefa_id,
    subtarefaId: comentario.subtarefa_id,
    tarefaTitulo: tarefa?.titulo?.trim() || "tarefa",
    subtarefaTitulo: subtarefa.titulo?.trim() || "subtarefa",
    comentarioId,
    atorNome,
  });
}

async function notifyAvisoReactionIfNeeded(
  comentarioId: string,
  reactorId: string,
  atorNome: string,
) {
  const { data: comentario } = await supabase
    .from("aviso_comentarios")
    .select("usuario_id, aviso_id")
    .eq("id", comentarioId)
    .single();
  if (!comentario?.usuario_id || comentario.usuario_id === reactorId) return;

  const { data: aviso } = await supabase
    .from("avisos")
    .select("titulo")
    .eq("id", comentario.aviso_id)
    .single();

  await notifyAvisoComentarioReacao({
    usuarioIds: [comentario.usuario_id],
    avisoId: comentario.aviso_id,
    titulo: aviso?.titulo?.trim() || "aviso",
    comentarioId,
    atorNome,
  });
}
