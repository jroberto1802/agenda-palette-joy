import type { Papel, Profile } from "@/types";

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.papel === "admin";
}

export function isGerente(profile: Profile | null | undefined): boolean {
  return profile?.papel === "gerente";
}

export function isAdminOrGerente(profile: Profile | null | undefined): boolean {
  return profile?.papel === "admin" || profile?.papel === "gerente";
}

export function canManageSetores(profile: Profile | null | undefined): boolean {
  return isAdmin(profile);
}

export function canManagePessoas(profile: Profile | null | undefined): boolean {
  return isAdminOrGerente(profile);
}

export const PAPEL_LABELS: Record<Papel, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  usuario: "Usuário",
  visualizador: "Visualizador",
};
