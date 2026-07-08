import { supabase } from "@/integrations/supabase/client";
import type { AdminCreateUserData } from "@/types";

export async function criarUsuarioAdmin(payload: AdminCreateUserData): Promise<{ user_id: string }> {
  const { data, error } = await supabase.functions.invoke("criar-usuario", {
    body: payload,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return { user_id: data.user_id as string };
}

export async function excluirUsuarioAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("excluir-usuario", {
    body: { user_id: userId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
