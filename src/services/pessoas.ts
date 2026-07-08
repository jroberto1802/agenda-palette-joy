import { supabase } from "@/integrations/supabase/client";
import { criarUsuarioAdmin, excluirUsuarioAdmin } from "@/services/admin";
import type { ProfileFormData, ProfileWithSetor } from "@/types";

const PESSOA_SELECT = `
  *,
  setor:setores(id, nome, cor),
  gestor:profiles!profiles_gestor_id_fkey(id, nome_completo, papel)
`;

const PESSOA_SELECT_BASIC = `*, setor:setores(id, nome, cor)`;

export async function getMyProfile(): Promise<ProfileWithSetor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  // Sem embed de gestor: self-join + RLS pode falhar e esconder a aba Cadastros.
  const { data, error } = await supabase
    .from("profiles")
    .select(PESSOA_SELECT_BASIC)
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return {
    ...(data as ProfileWithSetor),
    gestor: null,
  };
}

export async function listPessoas(search?: string): Promise<ProfileWithSetor[]> {
  let query = supabase.from("profiles").select(PESSOA_SELECT).order("nome_completo");

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(
      `nome_completo.ilike.%${term}%,cargo.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    let fallback = supabase
      .from("profiles")
      .select(PESSOA_SELECT_BASIC)
      .order("nome_completo");
    if (search?.trim()) {
      const term = search.trim();
      fallback = fallback.or(
        `nome_completo.ilike.%${term}%,cargo.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
    const second = await fallback;
    if (second.error) throw second.error;
    return (second.data ?? []).map((row) => ({
      ...(row as ProfileWithSetor),
      gestor: null,
    }));
  }
  return (data ?? []) as unknown as ProfileWithSetor[];
}
export async function countActiveAdmins(excludeId?: string): Promise<number> {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("papel", "admin")
    .eq("ativo", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function createPessoa(payload: ProfileFormData): Promise<{ user_id: string }> {
  if (!payload.email?.trim()) {
    throw new Error("E-mail é obrigatório.");
  }
  if (!payload.password?.trim()) {
    throw new Error("Senha provisória é obrigatória.");
  }
  if (!payload.papel) {
    throw new Error("Papel é obrigatório.");
  }

  return criarUsuarioAdmin({
    email: payload.email.trim(),
    password: payload.password,
    nome_completo: payload.nome_completo.trim(),
    papel: payload.papel,
    setor_id: payload.setor_id,
    gestor_id: payload.gestor_id,
  });
}

export async function updatePessoa(id: string, payload: ProfileFormData): Promise<ProfileWithSetor> {
  if (payload.papel !== "admin" || payload.ativo === false) {
    const current = await supabase
      .from("profiles")
      .select("papel, ativo")
      .eq("id", id)
      .single();

    if (current.error) throw current.error;

    const wasActiveAdmin = current.data.papel === "admin" && current.data.ativo;
    const willLoseAdmin =
      wasActiveAdmin && (payload.papel !== "admin" || payload.ativo === false);

    if (willLoseAdmin) {
      const remaining = await countActiveAdmins(id);
      if (remaining === 0) {
        throw new Error(
          "Não é possível inativar ou rebaixar o último Administrador do sistema.",
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      nome_completo: payload.nome_completo,
      cargo: payload.cargo || null,
      setor_id: payload.setor_id,
      papel: payload.papel,
      ativo: payload.ativo,
      gestor_id: payload.gestor_id,
    })
    .eq("id", id)
    .select(PESSOA_SELECT_BASIC)
    .single();

  if (error) throw error;
  return { ...(data as ProfileWithSetor), gestor: null };
}

export async function deletePessoa(id: string): Promise<void> {
  const { data: pessoa, error: fetchError } = await supabase
    .from("profiles")
    .select("papel, ativo")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  if (pessoa.papel === "admin" && pessoa.ativo) {
    const remaining = await countActiveAdmins(id);
    if (remaining === 0) {
      throw new Error("Não é possível excluir o último Administrador do sistema.");
    }
  }

  await excluirUsuarioAdmin(id);
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
    .select(PESSOA_SELECT_BASIC)
    .single();

  if (error) throw error;
  return { ...(data as ProfileWithSetor), gestor: null };
}
