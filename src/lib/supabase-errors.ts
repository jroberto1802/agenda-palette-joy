import type { PostgrestError } from "@supabase/supabase-js";

export function getSupabaseErrorMessage(error: PostgrestError | Error | null): string {
  if (!error) return "Erro desconhecido";
  if ("code" in error && error.code === "42501") {
    return "Você não tem permissão para esta ação.";
  }
  return error.message || "Erro ao processar solicitação.";
}
