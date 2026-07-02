import { supabase } from "@/integrations/supabase/client";
import type { ProfileFormData, ProfileWithSetor } from "@/types";

export async function getMyProfile(): Promise<ProfileWithSetor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("profiles")
    .select("*, setor:setores(id, nome, cor)")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data as ProfileWithSetor;
}

export async function listPessoas(search?: string): Promise<ProfileWithSetor[]> {
  let query = supabase
    .from("profiles")
    .select("*, setor:setores(id, nome, cor)")
    .order("nome_completo");

  if (search?.trim()) {
    query = query.or(`nome_completo.ilike.%${search.trim()}%,cargo.ilike.%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProfileWithSetor[];
}

export async function updatePessoa(id: string, payload: ProfileFormData): Promise<ProfileWithSetor> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      nome_completo: payload.nome_completo,
      cargo: payload.cargo || null,
      setor_id: payload.setor_id,
      papel: payload.papel,
      ativo: payload.ativo,
    })
    .eq("id", id)
    .select("*, setor:setores(id, nome, cor)")
    .single();

  if (error) throw error;
  return data as ProfileWithSetor;
}

export async function updateMyProfile(payload: {
  nome_completo: string;
  avatar_url?: string | null;
  cargo?: string | null;
}): Promise<ProfileWithSetor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      nome_completo: payload.nome_completo,
      avatar_url: payload.avatar_url ?? null,
      cargo: payload.cargo || null,
    })
    .eq("id", user.id)
    .select("*, setor:setores(id, nome, cor)")
    .single();

  if (error) throw error;
  return data as ProfileWithSetor;
}
