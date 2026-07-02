import { supabase } from "@/integrations/supabase/client";
import { notifyUsers } from "@/services/notificacoes";
import type {
  AvisoComentario,
  AvisoDetail,
  AvisoFormData,
  AvisoWithRelations,
} from "@/types";

const AVISO_SELECT = `
  *,
  criador:profiles!criado_por(id, nome_completo),
  setores:aviso_setores(setor:setores(id, nome)),
  pessoas:aviso_pessoas(usuario:profiles(id, nome_completo)),
  lido_por:aviso_lido_por(usuario_id)
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

  const { data: aviso, error } = await supabase
    .from("avisos")
    .insert({
      titulo: payload.titulo,
      conteudo: payload.conteudo,
      alcance: payload.alcance,
      fixado: payload.fixado,
      comentarios_permitidos: payload.comentarios_permitidos,
      criado_por: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  if (payload.alcance === "por_setor" && payload.setor_ids.length > 0) {
    const { error: setorError } = await supabase.from("aviso_setores").insert(
      payload.setor_ids.map((setor_id) => ({ aviso_id: aviso.id, setor_id })),
    );
    if (setorError) throw setorError;
  }

  if (payload.alcance === "pessoa_especifica" && payload.usuario_ids.length > 0) {
    const { error: pessoaError } = await supabase.from("aviso_pessoas").insert(
      payload.usuario_ids.map((usuario_id) => ({ aviso_id: aviso.id, usuario_id })),
    );
    if (pessoaError) throw pessoaError;
  }

  const detail = await getAvisoDetail(aviso.id);

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

  await notifyUsers(destinatarios, {
    tipo: "aviso_novo",
    referencia_tipo: "aviso",
    referencia_id: aviso.id,
  });

  return detail;
}

export async function deleteAviso(id: string): Promise<void> {
  const { error } = await supabase.from("avisos").delete().eq("id", id);
  if (error) throw error;
}

export async function createAvisoComentario(
  avisoId: string,
  conteudo: string,
): Promise<AvisoComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("aviso_comentarios")
    .insert({ aviso_id: avisoId, usuario_id: user.id, conteudo })
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  return data as AvisoComentario;
}

export function isAvisoLido(aviso: AvisoWithRelations, userId?: string): boolean {
  if (!userId) return false;
  return aviso.lido_por?.some((l) => l.usuario_id === userId) ?? false;
}
