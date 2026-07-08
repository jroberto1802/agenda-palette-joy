import { supabase } from "@/integrations/supabase/client";
import type { SetorFormData, SetorWithGerente } from "@/types";

const SETOR_SELECT = `
  *,
  gerente:profiles!setores_gerente_id_fkey(id, nome_completo, avatar_url)
`;

export async function listSetores(): Promise<SetorWithGerente[]> {
  const { data, error } = await supabase.from("setores").select(SETOR_SELECT).order("nome");

  if (error) throw error;
  return (data ?? []) as SetorWithGerente[];
}

export async function createSetor(payload: SetorFormData): Promise<SetorWithGerente> {
  const { data, error } = await supabase
    .from("setores")
    .insert({
      nome: payload.nome,
      cor: payload.cor || null,
      descricao: payload.descricao || null,
      gerente_id: payload.gerente_id ?? null,
    })
    .select(SETOR_SELECT)
    .single();

  if (error) throw error;
  return data as SetorWithGerente;
}

export async function updateSetor(id: string, payload: SetorFormData): Promise<SetorWithGerente> {
  const { data, error } = await supabase
    .from("setores")
    .update({
      nome: payload.nome,
      cor: payload.cor || null,
      descricao: payload.descricao || null,
      gerente_id: payload.gerente_id ?? null,
    })
    .eq("id", id)
    .select(SETOR_SELECT)
    .single();

  if (error) throw error;
  return data as SetorWithGerente;
}

export async function countPessoasPorSetor(setorId: string): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("setor_id", setorId);

  if (error) throw error;
  return count ?? 0;
}

export async function deleteSetor(id: string): Promise<void> {
  const linked = await countPessoasPorSetor(id);
  if (linked > 0) {
    throw new Error(
      "Não é possível excluir o setor enquanto houver pessoas vinculadas. Realoque as pessoas antes de excluir.",
    );
  }

  const { error } = await supabase.from("setores").delete().eq("id", id);
  if (error) throw error;
}
