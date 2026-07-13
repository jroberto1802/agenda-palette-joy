import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentActor,
  listAvisoMencionaveis,
  notifyAvisoComentario,
  notifyAvisoMencao,
  notifyAvisoNovo,
  notifyAvisoResposta,
  resolveMentionIds,
} from "@/services/notificacao-events";
import type {
  AvisoComentario,
  AvisoDetail,
  AvisoFormData,
  AvisoWithRelations,
} from "@/types";

const AVISO_SELECT = `
  *,
  criador:profiles!criado_por(id, nome_completo, avatar_url),
  setores:aviso_setores(setor:setores(id, nome)),
  pessoas:aviso_pessoas(usuario:profiles(id, nome_completo, avatar_url)),
  lido_por:aviso_lido_por(usuario_id)
`;

const AVISO_SELECT_LITE = `
  *,
  criador:profiles!criado_por(id, nome_completo, avatar_url)
`;

const COMENTARIO_SELECT = `
  *,
  usuario:profiles!usuario_id(id, nome_completo, avatar_url)
`;

export async function listAvisos(): Promise<AvisoWithRelations[]> {
  const { data, error } = await supabase
    .from("avisos")
    .select(AVISO_SELECT)
    .order("fixado", { ascending: false })
    .order("data_publicacao", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AvisoWithRelations[];
}

export async function getAvisoDetail(id: string): Promise<AvisoDetail> {
  const { data, error } = await supabase
    .from("avisos")
    .select(
      `${AVISO_SELECT},
      comentarios:aviso_comentarios(${COMENTARIO_SELECT})`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "aviso_comentarios", ascending: true })
    .single();

  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const lido = (data as AvisoWithRelations).lido_por?.some((l) => l.usuario_id === user.id);
    if (!lido) {
      await supabase.from("aviso_lido_por").upsert({
        aviso_id: id,
        usuario_id: user.id,
      });
    }
  }

  return data as unknown as AvisoDetail;
}

export async function createAviso(payload: AvisoFormData): Promise<AvisoWithRelations> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const avisoId = crypto.randomUUID();

  const { error } = await supabase.from("avisos").insert({
    id: avisoId,
    titulo: payload.titulo,
    conteudo: payload.conteudo,
    alcance: payload.alcance,
    prioridade: payload.prioridade,
    data_expiracao: payload.data_expiracao,
    fixado: payload.fixado,
    comentarios_permitidos: payload.comentarios_permitidos,
    criado_por: user.id,
  });

  if (error) throw error;

  if (payload.alcance === "por_setor" && payload.setor_ids.length > 0) {
    const { error: setorError } = await supabase.from("aviso_setores").insert(
      payload.setor_ids.map((setor_id) => ({ aviso_id: avisoId, setor_id })),
    );
    if (setorError) throw setorError;
  }

  if (payload.alcance === "pessoa_especifica" && payload.usuario_ids.length > 0) {
    const { error: pessoaError } = await supabase.from("aviso_pessoas").insert(
      payload.usuario_ids.map((usuario_id) => ({ aviso_id: avisoId, usuario_id })),
    );
    if (pessoaError) throw pessoaError;
  }

  const { data: aviso, error: fetchError } = await supabase
    .from("avisos")
    .select(AVISO_SELECT)
    .eq("id", avisoId)
    .single();

  if (fetchError) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("avisos")
      .select(AVISO_SELECT_LITE)
      .eq("id", avisoId)
      .single();

    if (fallbackError) throw fetchError;
    return {
      ...(fallback as AvisoWithRelations),
      setores: [],
      pessoas: [],
      lido_por: [],
    };
  }

  let destinatarios: string[] = [];
  if (payload.alcance === "todos") {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("ativo", true)
      .neq("id", user.id);
    destinatarios = (profiles ?? []).map((p) => p.id);
  } else if (payload.alcance === "por_setor") {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("ativo", true)
      .in("setor_id", payload.setor_ids)
      .neq("id", user.id);
    destinatarios = (profiles ?? []).map((p) => p.id);
  } else {
    destinatarios = payload.usuario_ids.filter((id) => id !== user.id);
  }

  const ator = await getCurrentActor();
  await notifyAvisoNovo({
    usuarioIds: destinatarios,
    avisoId,
    titulo: aviso.titulo,
    atorNome: ator?.nome ?? "Alguém",
  });

  return aviso as AvisoWithRelations;
}

export async function deleteAviso(id: string): Promise<void> {
  const { error } = await supabase.from("avisos").delete().eq("id", id);
  if (error) throw error;
}

export async function setAvisoLido(avisoId: string, lido: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  if (lido) {
    const { error } = await supabase.from("aviso_lido_por").upsert({
      aviso_id: avisoId,
      usuario_id: user.id,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("aviso_lido_por")
    .delete()
    .eq("aviso_id", avisoId)
    .eq("usuario_id", user.id);

  if (error) throw error;
}

export async function createAvisoComentario(
  avisoId: string,
  conteudo: string,
  parentId: string | null = null,
): Promise<AvisoComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("aviso_comentarios")
      .select("id, parent_id, usuario_id, aviso_id")
      .eq("id", parentId)
      .single();
    if (parentError || !parent) throw new Error("Comentário original não encontrado.");
    if (parent.aviso_id !== avisoId) throw new Error("Comentário inválido para este aviso.");
    if (parent.parent_id) throw new Error("Apenas um nível de resposta é permitido.");
  }

  const { data, error } = await supabase
    .from("aviso_comentarios")
    .insert({
      aviso_id: avisoId,
      usuario_id: user.id,
      conteudo,
      parent_id: parentId,
    })
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  const comentario = data as AvisoComentario;

  const [{ data: aviso }, ator, mencionaveis] = await Promise.all([
    supabase.from("avisos").select("criado_por, titulo").eq("id", avisoId).single(),
    getCurrentActor(),
    listAvisoMencionaveis(avisoId),
  ]);

  const atorNome = ator?.nome ?? "Alguém";
  const titulo = aviso?.titulo ?? "aviso";
  const mencoes = (await resolveMentionIds(conteudo, mencionaveis)).filter(
    (id) => id !== user.id,
  );

  const jobs: Promise<unknown>[] = [];

  if (parentId) {
    const { data: parent } = await supabase
      .from("aviso_comentarios")
      .select("usuario_id")
      .eq("id", parentId)
      .single();
    if (parent?.usuario_id && parent.usuario_id !== user.id) {
      jobs.push(
        notifyAvisoResposta({
          usuarioIds: [parent.usuario_id],
          avisoId,
          titulo,
          comentarioId: comentario.id,
          atorNome,
        }),
      );
    }
  } else {
    const comentarioDestinatarios = [aviso?.criado_por].filter(
      (id): id is string => !!id && id !== user.id && !mencoes.includes(id),
    );
    if (comentarioDestinatarios.length > 0) {
      jobs.push(
        notifyAvisoComentario({
          usuarioIds: comentarioDestinatarios,
          avisoId,
          titulo,
          comentarioId: comentario.id,
          atorNome,
        }),
      );
    }
  }

  if (mencoes.length > 0) {
    jobs.push(
      notifyAvisoMencao({
        usuarioIds: mencoes,
        avisoId,
        titulo,
        comentarioId: comentario.id,
        atorNome,
      }),
    );
  }

  void Promise.all(jobs.map((job) => job.catch(() => undefined)));

  return comentario;
}

export function isAvisoLido(aviso: AvisoWithRelations, userId?: string): boolean {
  if (!userId) return false;
  return aviso.lido_por?.some((l) => l.usuario_id === userId) ?? false;
}
