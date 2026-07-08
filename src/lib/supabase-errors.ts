import type { PostgrestError } from "@supabase/supabase-js";

export function getSupabaseErrorMessage(error: PostgrestError | Error | null): string {
  if (!error) return "Erro desconhecido";

  const message = error.message || "Erro ao processar solicitação.";

  if ("code" in error && error.code === "42501") {
    return "Você não tem permissão para esta ação.";
  }

  if ("code" in error && error.code === "23505") {
    if (message.toLowerCase().includes("email") || message.toLowerCase().includes("profiles_email")) {
      return "Já existe uma pessoa cadastrada com este e-mail.";
    }
    return "Registro duplicado. Verifique os dados informados.";
  }

  if (message.includes("último Administrador")) {
    return message;
  }
  if (message.includes("pessoas vinculadas")) {
    return message;
  }
  if (
    message.toLowerCase().includes("already been registered") ||
    message.toLowerCase().includes("already registered") ||
    message.toLowerCase().includes("user already exists") ||
    message.toLowerCase().includes("email_exists")
  ) {
    return "Já existe uma pessoa cadastrada com este e-mail.";
  }

  return message;
}
