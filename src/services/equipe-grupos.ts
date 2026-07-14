import { supabase } from "@/integrations/supabase/client";
import type { EquipeGrupo, EquipeGrupoWithMembros } from "@/types";

const GRUPO_SELECT = `
  *,
  membros:equipe_grupo_membros(grupo_id, usuario_id, created_at)
`;

export const EQUIPE_SEM_GRUPO_ID = "__outros__";

export async function listEquipeGrupos(): Promise<EquipeGrupoWithMembros[]> {
  const { data, error } = await supabase
    .from("equipe_grupos")
    .select(GRUPO_SELECT)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw error;
  return (data ?? []) as EquipeGrupoWithMembros[];
}

export async function createEquipeGrupo(nome: string): Promise<EquipeGrupo> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe o nome do grupo.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: existing, error: existingError } = await supabase
    .from("equipe_grupos")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1);

  if (existingError) throw existingError;

  const nextOrdem = (existing?.[0]?.ordem ?? -1) + 1;

  const { data, error } = await supabase
    .from("equipe_grupos")
    .insert({
      nome: trimmed,
      ordem: nextOrdem,
      criado_por: user.id,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function renameEquipeGrupo(id: string, nome: string): Promise<EquipeGrupo> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe o nome do grupo.");

  const { data, error } = await supabase
    .from("equipe_grupos")
    .update({ nome: trimmed })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEquipeGrupo(id: string): Promise<void> {
  const { error } = await supabase.from("equipe_grupos").delete().eq("id", id);
  if (error) throw error;
}

/** Move a pessoa para um grupo, ou remove a atribuição (seção Outros). */
export async function movePessoaEquipeGrupo(
  usuarioId: string,
  grupoId: string | null,
): Promise<void> {
  if (!grupoId || grupoId === EQUIPE_SEM_GRUPO_ID) {
    const { error } = await supabase
      .from("equipe_grupo_membros")
      .delete()
      .eq("usuario_id", usuarioId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("equipe_grupo_membros").upsert(
    { grupo_id: grupoId, usuario_id: usuarioId },
    { onConflict: "usuario_id" },
  );

  if (error) throw error;
}
