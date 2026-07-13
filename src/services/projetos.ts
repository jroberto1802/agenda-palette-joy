import { supabase } from "@/integrations/supabase/client";
import type { ProjetoFormData, ProjetoMembro, ProjetoWithResponsavel } from "@/types";

const PROJETO_SELECT = `
  *,
  responsavel:profiles!projetos_responsavel_id_fkey(id, nome_completo, avatar_url),
  membros:projeto_membros(
    usuario_id,
    usuario:profiles!projeto_membros_usuario_id_fkey(id, nome_completo, avatar_url, cargo, papel)
  )
`;

async function syncProjetoMembros(projetoId: string, usuarioIds: string[]): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("projeto_membros")
    .delete()
    .eq("projeto_id", projetoId);

  if (deleteError) throw deleteError;

  if (unique.length === 0) return;

  const { error: insertError } = await supabase.from("projeto_membros").insert(
    unique.map((usuario_id) => ({
      projeto_id: projetoId,
      usuario_id,
    })),
  );

  if (insertError) throw insertError;
}

export async function listProjetoMembros(projetoId: string): Promise<ProjetoMembro[]> {
  const { data, error } = await supabase
    .from("projeto_membros")
    .select(
      "usuario_id, usuario:profiles!projeto_membros_usuario_id_fkey(id, nome_completo, avatar_url, cargo, papel)",
    )
    .eq("projeto_id", projetoId);

  if (error) throw error;

  return (data ?? [])
    .map((row) => row.usuario)
    .filter((u): u is ProjetoMembro => !!u)
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
}

export async function getProjeto(id: string): Promise<ProjetoWithResponsavel> {
  const { data, error } = await supabase
    .from("projetos")
    .select(PROJETO_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ProjetoWithResponsavel;
}

export async function listProjetos(search?: string): Promise<ProjetoWithResponsavel[]> {
  let query = supabase.from("projetos").select(PROJETO_SELECT).order("nome");

  if (search?.trim()) {
    query = query.ilike("nome", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjetoWithResponsavel[];
}

export async function createProjeto(payload: ProjetoFormData): Promise<ProjetoWithResponsavel> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("projetos")
    .insert({
      nome: payload.nome.trim(),
      descricao: payload.descricao?.trim() || null,
      responsavel_id: payload.responsavel_id,
      data_inicio: payload.data_inicio,
      data_termino_prevista: payload.data_termino_prevista,
      status: payload.status,
      criado_por: user.id,
    })
    .select(PROJETO_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um projeto com este nome.");
    }
    throw error;
  }

  const membroIds = [...payload.membro_ids];
  if (payload.responsavel_id && !membroIds.includes(payload.responsavel_id)) {
    membroIds.push(payload.responsavel_id);
  }

  await syncProjetoMembros(data.id, membroIds);
  return getProjeto(data.id);
}

export async function updateProjeto(
  id: string,
  payload: ProjetoFormData,
): Promise<ProjetoWithResponsavel> {
  const { data, error } = await supabase
    .from("projetos")
    .update({
      nome: payload.nome.trim(),
      descricao: payload.descricao?.trim() || null,
      responsavel_id: payload.responsavel_id,
      data_inicio: payload.data_inicio,
      data_termino_prevista: payload.data_termino_prevista,
      status: payload.status,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um projeto com este nome.");
    }
    throw error;
  }

  await syncProjetoMembros(data.id, payload.membro_ids);
  return getProjeto(id);
}

export async function addProjetoMembro(projetoId: string, usuarioId: string): Promise<void> {
  const { error } = await supabase.from("projeto_membros").upsert(
    { projeto_id: projetoId, usuario_id: usuarioId },
    { onConflict: "projeto_id,usuario_id" },
  );
  if (error) throw error;
}

export async function removeProjetoMembro(projetoId: string, usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from("projeto_membros")
    .delete()
    .eq("projeto_id", projetoId)
    .eq("usuario_id", usuarioId);

  if (error) throw error;
}

export async function countTarefasPorProjeto(projetoId: string): Promise<number> {
  const { count, error } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .is("deleted_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function countTarefasAbertasPorProjeto(projetoId: string): Promise<number> {
  const { count, error } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .is("deleted_at", null)
    .neq("status", "concluida");

  if (error) throw error;
  return count ?? 0;
}

export async function deleteProjeto(id: string): Promise<void> {
  const abertas = await countTarefasAbertasPorProjeto(id);
  if (abertas > 0) {
    throw new Error(
      "Não é possível excluir o projeto enquanto houver tarefas em aberto vinculadas a ele.",
    );
  }

  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) throw error;
}
