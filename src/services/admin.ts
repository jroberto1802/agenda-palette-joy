import { supabase } from "@/integrations/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { AdminCreateUserData, AdminRestaurarSenhaData } from "@/types";

function mapFunctionError(error: unknown, data: unknown, action: string): Error {
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    return new Error(String((data as { error: unknown }).error));
  }

  const message = getSupabaseErrorMessage(error as Error);
  const lower = message.toLowerCase();

  if (
    lower.includes("failed to send a request") ||
    lower.includes("failed to fetch") ||
    lower.includes("not found") ||
    lower.includes("404")
  ) {
    return new Error(
      `A função "${action}" não está disponível neste projeto Supabase. ` +
        "Faça o deploy das Edge Functions (criar-usuario/excluir-usuario/restaurar-senha) " +
        "e tente novamente.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export async function criarUsuarioAdmin(payload: AdminCreateUserData): Promise<{ user_id: string }> {
  const { data, error } = await supabase.functions.invoke("criar-usuario", {
    body: payload,
  });

  if (error) throw mapFunctionError(error, data, "criar-usuario");
  if (data?.error) throw new Error(data.error);

  return { user_id: data.user_id as string };
}

export async function excluirUsuarioAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("excluir-usuario", {
    body: { user_id: userId },
  });

  if (error) throw mapFunctionError(error, data, "excluir-usuario");
  if (data?.error) throw new Error(data.error);
}

export async function restaurarSenhaUsuario(
  payload: AdminRestaurarSenhaData,
): Promise<{ senha_temporaria_expira_em: string }> {
  const { data, error } = await supabase.functions.invoke("restaurar-senha", {
    body: payload,
  });

  if (error) throw mapFunctionError(error, data, "restaurar-senha");
  if (data?.error) throw new Error(data.error);

  return {
    senha_temporaria_expira_em: String(data.senha_temporaria_expira_em ?? ""),
  };
}
