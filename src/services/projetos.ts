import { supabase } from "@/integrations/supabase/client";
import type { ProjetoFormData, ProjetoWithResponsavel } from "@/types";

const PROJETO_SELECT = `
  *,
  responsavel:profiles!projetos_responsavel_id_fkey(id, nome_completo, avatar_url)
`;

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

  return data as ProjetoWithResponsavel;
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
    .select(PROJETO_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um projeto com este nome.");
    }
    throw error;
  }

  return data as ProjetoWithResponsavel;
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
