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

/** Nesta fase: Administrador e Gestor podem CRUD de Setores e Pessoas. */
export function canManageSetores(profile: Profile | null | undefined): boolean {
  return isAdminOrGerente(profile);
}

export function canManagePessoas(profile: Profile | null | undefined): boolean {
  return isAdminOrGerente(profile);
}

/** Relatórios: somente Administrador. */
export function canAccessRelatorios(profile: Profile | null | undefined): boolean {
  return isAdmin(profile);
}

/**
 * Configurações:
 * - Admin: acesso completo
 * - Gestor: apenas Setores e Pessoas
 * - Usuário: sem acesso
 */
export function canAccessConfiguracoes(profile: Profile | null | undefined): boolean {
  return isAdminOrGerente(profile);
}

/** Aparência/cores: somente Administrador. */
export function canManageAparencia(profile: Profile | null | undefined): boolean {
  return isAdmin(profile);
}

/** Demais seções administrativas em Configurações (empresa, perfil, segurança). */
export function canAccessConfiguracoesAdminSections(
  profile: Profile | null | undefined,
): boolean {
  return isAdmin(profile);
}

/** Qualquer usuário autenticado pode criar projeto. */
export function canCreateProjetos(profile: Profile | null | undefined): boolean {
  return !!profile;
}

/**
 * Exclusão de projeto:
 * - com atividades abertas (não concluídas): somente administrador;
 * - sem abertas: criador, gestor ou administrador.
 */
export function canDeleteProjeto(
  profile: Profile | null | undefined,
  projeto: { criado_por: string | null } | null | undefined,
  hasOpenActivities: boolean,
): boolean {
  if (!profile || !projeto) return false;
  if (hasOpenActivities) return isAdmin(profile);
  return (
    isAdmin(profile) ||
    isGerente(profile) ||
    projeto.criado_por === profile.id
  );
}

/** @deprecated Prefira `canDeleteProjeto` com contexto do projeto. */
export function canDeleteProjetos(profile: Profile | null | undefined): boolean {
  return isAdminOrGerente(profile);
}

/** Adicionar/remover membros: criador, gestor ou administrador. */
export function canManageProjetoMembros(
  profile: Profile | null | undefined,
  projeto: { criado_por: string | null } | null | undefined,
): boolean {
  if (!profile || !projeto) return false;
  return (
    isAdmin(profile) ||
    isGerente(profile) ||
    projeto.criado_por === profile.id
  );
}

export const PAPEL_LABELS: Record<Papel, string> = {
  admin: "Administrador",
  gerente: "Gestor",
  usuario: "Usuário",
  visualizador: "Visualizador",
};
