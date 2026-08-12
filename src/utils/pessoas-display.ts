/** Pessoa desativada: usado para contraste baixo em histórico. */
export function isPessoaDesativada(
  pessoa?: { ativo?: boolean | null } | null,
): boolean {
  return pessoa?.ativo === false;
}

/** Classes para avatar/nome de pessoa desativada em contextos históricos. */
export function pessoaDesativadaClassName(
  pessoa?: { ativo?: boolean | null } | null,
): string | undefined {
  return isPessoaDesativada(pessoa) ? "opacity-45 grayscale" : undefined;
}

export function pessoaDesativadaNomeClassName(
  pessoa?: { ativo?: boolean | null } | null,
): string | undefined {
  return isPessoaDesativada(pessoa) ? "text-muted-foreground/70" : undefined;
}
