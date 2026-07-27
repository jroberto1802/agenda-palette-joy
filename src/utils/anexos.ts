/** Limite máximo por anexo: 500 KB (512.000 bytes). */
export const ANEXO_TAMANHO_MAXIMO_BYTES = 500 * 1024;

export const ANEXO_TAMANHO_EXCEDIDO_MSG =
  "O arquivo excede o tamanho máximo permitido de 500 KB. Compacte ou reduza o arquivo antes de enviá-lo.";

export function assertAnexoTamanhoPermitido(file: Pick<File, "size">): void {
  if (file.size > ANEXO_TAMANHO_MAXIMO_BYTES) {
    throw new Error(ANEXO_TAMANHO_EXCEDIDO_MSG);
  }
}

/** Normaliza erros de tamanho vindos do Storage/Postgres para a mensagem padrão. */
export function normalizeAnexoUploadError(error: unknown): Error {
  if (error instanceof Error && error.message === ANEXO_TAMANHO_EXCEDIDO_MSG) {
    return error;
  }

  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const lower = message.toLowerCase();
  if (
    lower.includes("maximum allowed size") ||
    lower.includes("payload too large") ||
    lower.includes("entity too large") ||
    lower.includes("file_size_limit") ||
    lower.includes("object exceeded") ||
    lower.includes("anexo_tamanho") ||
    lower.includes("tamanho_maximo") ||
    message.includes("500 KB")
  ) {
    return new Error(ANEXO_TAMANHO_EXCEDIDO_MSG);
  }

  return error instanceof Error ? error : new Error(message || "Erro ao enviar anexo");
}
