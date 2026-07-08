import type { Papel, Profile } from "@/types";

/** Papéis disponíveis na criação/edição desta fase (Cadastros). */
export const PAPEIS_CADASTRO = ["admin", "gerente", "usuario"] as const satisfies readonly Papel[];

export type PapelCadastro = (typeof PAPEIS_CADASTRO)[number];

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.papel === "admin";
}

export function isGerente(profile: Profile | null | undefined): boolean {
  return profile?.papel === "gerente";
}

export function isAdminOrGerente(profile: Profile | null | undefined): boolean {
  return profile?.papel === "admin" || profile?.papel === "gerente";
}

/** Nesta fase: somente Administrador pode CRUD de Setores e Pessoas. */
export function canManageSetores(profile: Profile | null | undefined): boolean {
  return isAdmin(profile);
}

export function canManagePessoas(profile: Profile | null | undefined): boolean {
  return isAdmin(profile);
}

export const PAPEL_LABELS: Record<Papel, string> = {
  admin: "Administrador",
  gerente: "Gestor",
  usuario: "Usuário",
  visualizador: "Visualizador",
};
