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

/** Responsáveis da subtarefa. */
export async function getSubtarefaResponsavelIds(subtarefaId: string): Promise<string[]> {
  const { data: responsaveis } = await supabase
    .from("subtarefa_responsaveis")
    .select("usuario_id")
    .eq("subtarefa_id", subtarefaId);

  return [...new Set((responsaveis ?? []).map((r) => r.usuario_id).filter(Boolean))];
}

/** Criador + responsáveis da subtarefa. */
export async function getSubtarefaStakeholderIds(subtarefaId: string): Promise<string[]> {
  const [{ data: subtarefa }, responsaveis] = await Promise.all([
    supabase.from("subtarefas").select("criado_por").eq("id", subtarefaId).single(),
    getSubtarefaResponsavelIds(subtarefaId),
  ]);

  return [
    ...new Set(
      [subtarefa?.criado_por, ...responsaveis].filter((id): id is string => !!id),
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
    mensagem: `${params.atorNome} alterou a data da tarefa ${params.titulo}`,
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
  subtarefaId?: string;
  subtarefaTitulo?: string;
}) {
  const subtarefaLabel = params.subtarefaTitulo?.trim();
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_subtarefa_concluida",
    mensagem: subtarefaLabel
      ? `${params.atorNome} concluiu a subtarefa ${subtarefaLabel} em ${params.titulo}`
      : `${params.atorNome} concluiu uma subtarefa em ${params.titulo}`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
    meta: params.subtarefaId ? { subtarefa_id: params.subtarefaId } : undefined,
  });
}

export async function notifySubtarefaAnexo(params: {
  usuarioIds: string[];
  tarefaId: string;
  subtarefaId: string;
  tarefaTitulo: string;
  subtarefaTitulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_anexo",
    mensagem: `${params.atorNome} enviou um anexo na subtarefa ${params.subtarefaTitulo} (${params.tarefaTitulo})`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
    meta: { aba: "anexos", subtarefa_id: params.subtarefaId },
  });
}

export async function notifySubtarefaMencao(params: {
  usuarioIds: string[];
  tarefaId: string;
  subtarefaId: string;
  comentarioId: string;
  tarefaTitulo: string;
  subtarefaTitulo: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_mencao",
    mensagem: `${params.atorNome} mencionou você em um comentário na subtarefa ${params.subtarefaTitulo} (${params.tarefaTitulo})`,
    referencia_tipo: "tarefa",
    referencia_id: params.tarefaId,
    meta: {
      aba: "comentarios",
      comentario_id: params.comentarioId,
      subtarefa_id: params.subtarefaId,
    },
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

export async function notifyTarefaResposta(params: {
  usuarioIds: string[];
  tarefaId: string;
  titulo: string;
  comentarioId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "tarefa_resposta",
    mensagem: `${params.atorNome} respondeu seu comentário na tarefa ${params.titulo}`,
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

export async function notifyAvisoResposta(params: {
  usuarioIds: string[];
  avisoId: string;
  titulo: string;
  comentarioId: string;
  atorNome: string;
}) {
  await notifyEvent({
    usuarioIds: params.usuarioIds,
    tipo: "aviso_resposta",
    mensagem: `${params.atorNome} respondeu seu comentário no aviso ${params.titulo}`,
    referencia_tipo: "aviso",
    referencia_id: params.avisoId,
    meta: { comentario_id: params.comentarioId },
  });
}

export async function resolveMentionIds(
  conteudo: string,
  candidatos?: { id: string; nome_completo: string }[],
): Promise<string[]> {
  if (candidatos) {
    return extractMentionedUserIds(conteudo, candidatos);
  }

  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome_completo")
    .eq("ativo", true);

  return extractMentionedUserIds(conteudo, pessoas ?? []);
}

/** Pessoas elegíveis para @ em uma tarefa (projeto/setor/responsáveis/acesso). */
export async function listTarefaMencionaveis(
  tarefaId: string,
): Promise<{ id: string; nome_completo: string; avatar_url: string | null }[]> {
  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("criado_por, setor_id, projeto_id")
    .eq("id", tarefaId)
    .single();

  if (!tarefa) return [];

  const ids = new Set<string>();
  if (tarefa.criado_por) ids.add(tarefa.criado_por);

  const [{ data: responsaveis }, { data: observadores }] = await Promise.all([
    supabase.from("tarefa_responsaveis").select("usuario_id").eq("tarefa_id", tarefaId),
    supabase.from("tarefa_observadores").select("usuario_id").eq("tarefa_id", tarefaId),
  ]);

  for (const row of responsaveis ?? []) ids.add(row.usuario_id);
  for (const row of observadores ?? []) ids.add(row.usuario_id);

  if (tarefa.projeto_id) {
    const { data: membros } = await supabase
      .from("projeto_membros")
      .select("usuario_id")
      .eq("projeto_id", tarefa.projeto_id);
    for (const row of membros ?? []) ids.add(row.usuario_id);
  } else if (tarefa.setor_id) {
    const { data: doSetor } = await supabase
      .from("profiles")
      .select("id")
      .eq("ativo", true)
      .eq("setor_id", tarefa.setor_id);
    for (const row of doSetor ?? []) ids.add(row.id);
  }

  if (ids.size === 0) return [];

  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome_completo, avatar_url")
    .eq("ativo", true)
    .in("id", [...ids]);

  return (pessoas ?? []).map((p) => ({
    id: p.id,
    nome_completo: p.nome_completo,
    avatar_url: p.avatar_url,
  }));
}

/** Pessoas elegíveis para @ em uma subtarefa (responsáveis/observadores/acesso da tarefa pai). */
export async function listSubtarefaMencionaveis(
  subtarefaId: string,
): Promise<{ id: string; nome_completo: string; avatar_url: string | null }[]> {
  const { data: subtarefa } = await supabase
    .from("subtarefas")
    .select("criado_por, tarefa_id, setor_id, projeto_id")
    .eq("id", subtarefaId)
    .single();

  if (!subtarefa) return [];

  const ids = new Set<string>();
  if (subtarefa.criado_por) ids.add(subtarefa.criado_por);

  const [{ data: responsaveis }, { data: observadores }, mencionaveisTarefa] = await Promise.all([
    supabase
      .from("subtarefa_responsaveis")
      .select("usuario_id")
      .eq("subtarefa_id", subtarefaId),
    supabase
      .from("subtarefa_observadores")
      .select("usuario_id")
      .eq("subtarefa_id", subtarefaId),
    listTarefaMencionaveis(subtarefa.tarefa_id),
  ]);

  for (const row of responsaveis ?? []) ids.add(row.usuario_id);
  for (const row of observadores ?? []) ids.add(row.usuario_id);
  for (const pessoa of mencionaveisTarefa) ids.add(pessoa.id);

  if (subtarefa.projeto_id) {
    const { data: membros } = await supabase
      .from("projeto_membros")
      .select("usuario_id")
      .eq("projeto_id", subtarefa.projeto_id);
    for (const row of membros ?? []) ids.add(row.usuario_id);
  } else if (subtarefa.setor_id) {
    const { data: doSetor } = await supabase
      .from("profiles")
      .select("id")
      .eq("ativo", true)
      .eq("setor_id", subtarefa.setor_id);
    for (const row of doSetor ?? []) ids.add(row.id);
  }

  if (ids.size === 0) return [];

  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome_completo, avatar_url")
    .eq("ativo", true)
    .in("id", [...ids]);

  return (pessoas ?? []).map((p) => ({
    id: p.id,
    nome_completo: p.nome_completo,
    avatar_url: p.avatar_url,
  }));
}

/** Pessoas elegíveis para @ em um aviso (alcance do aviso + criador). */
export async function listAvisoMencionaveis(
  avisoId: string,
): Promise<{ id: string; nome_completo: string; avatar_url: string | null }[]> {
  const { data: aviso } = await supabase
    .from("avisos")
    .select(
      "criado_por, alcance, setores:aviso_setores(setor_id), pessoas:aviso_pessoas(usuario_id)",
    )
    .eq("id", avisoId)
    .single();

  if (!aviso) return [];

  const ids = new Set<string>();
  if (aviso.criado_por) ids.add(aviso.criado_por);

  if (aviso.alcance === "todos") {
    const { data: todos } = await supabase.from("profiles").select("id").eq("ativo", true);
    for (const row of todos ?? []) ids.add(row.id);
  } else if (aviso.alcance === "por_setor") {
    const setorIds = (aviso.setores ?? [])
      .map((s: { setor_id: string }) => s.setor_id)
      .filter(Boolean);
    if (setorIds.length > 0) {
      const { data: doSetor } = await supabase
        .from("profiles")
        .select("id")
        .eq("ativo", true)
        .in("setor_id", setorIds);
      for (const row of doSetor ?? []) ids.add(row.id);
    }
  } else {
    for (const row of aviso.pessoas ?? []) {
      if ((row as { usuario_id: string }).usuario_id) {
        ids.add((row as { usuario_id: string }).usuario_id);
      }
    }
  }

  if (ids.size === 0) return [];

  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome_completo, avatar_url")
    .eq("ativo", true)
    .in("id", [...ids]);

  return (pessoas ?? []).map((p) => ({
    id: p.id,
    nome_completo: p.nome_completo,
    avatar_url: p.avatar_url,
  }));
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
