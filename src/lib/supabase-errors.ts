import type { PostgrestError } from "@supabase/supabase-js";

function extractMessageFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (record.error && typeof record.error === "object") {
    const nested = extractMessageFromUnknown(record.error);
    if (nested) return nested;
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  if (typeof record.msg === "string" && record.msg.trim()) return record.msg;
  return null;
}

export async function readFunctionsInvokeMessage(
  error: unknown,
  data?: unknown,
): Promise<string | null> {
  const fromData = extractMessageFromUnknown(data);
  if (fromData) return fromData;

  if (!error || typeof error !== "object" || !("context" in error)) {
    return error instanceof Error ? error.message : null;
  }

  const ctx = (error as { context: unknown }).context;
  if (typeof Response !== "undefined" && ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      const fromBody = extractMessageFromUnknown(body);
      if (fromBody) return fromBody;
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // ignore
      }
    }
  } else {
    const fromCtx = extractMessageFromUnknown(ctx);
    if (fromCtx) return fromCtx;
  }

  return error instanceof Error ? error.message : null;
}

export function getSupabaseErrorMessage(error: PostgrestError | Error | null): string {
  if (!error) return "Erro desconhecido";

  const message = error.message || "Erro ao processar solicitação.";
  const lower = message.toLowerCase();

  if ("code" in error && error.code === "42501") {
    return "Você não tem permissão para esta ação.";
  }

  if ("code" in error && error.code === "23505") {
    if (lower.includes("email") || lower.includes("profiles_email")) {
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
  if (lower.includes("subtarefas abertas") && lower.includes("concluir")) {
    return "Não é possível concluir esta tarefa: existem subtarefas abertas. Conclua-as primeiro.";
  }
  if (
    message.includes("tamanho máximo permitido de 500 KB") ||
    lower.includes("maximum allowed size") ||
    lower.includes("payload too large") ||
    lower.includes("entity too large")
  ) {
    return "O arquivo excede o tamanho máximo permitido de 500 KB. Compacte ou reduza o arquivo antes de enviá-lo.";
  }
  if (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("email_exists")
  ) {
    return "Já existe uma pessoa cadastrada com este e-mail.";
  }
  if (
    lower.includes("leaked") ||
    lower.includes("pwned") ||
    lower.includes("have i been") ||
    lower.includes("easy to guess")
  ) {
    return "Esta senha é muito comum ou já apareceu em vazamentos. Escolha outra senha provisória.";
  }
  if (
    lower.includes("password") &&
    (lower.includes("at least") ||
      lower.includes("too short") ||
      lower.includes("characters") ||
      lower.includes("weak"))
  ) {
    return "A senha não atende à política do sistema. Use uma senha mais longa e segura.";
  }
  if (lower.includes("invalid jwt") || lower.includes("missing authorization")) {
    return "Sessão expirada ou inválida. Saia e entre novamente.";
  }
  if (lower.includes("database error creating new user")) {
    return "Não foi possível criar o usuário. Verifique se o e-mail já está em uso.";
  }
  if (lower.includes("edge function returned a non-2xx status code")) {
    return "Não foi possível concluir a operação no servidor. Tente novamente; se persistir, saia e entre novamente.";
  }

  return message;
}
