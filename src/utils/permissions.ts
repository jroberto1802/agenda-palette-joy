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

/**
 * Restaurar senha em Configurações > Pessoas:
 * - Administrador: qualquer perfil.
 * - Gestor: apenas Gestores e Usuários (nunca Administrador).
 * - Usuário: sem acesso.
 */
export function canRestaurarSenha(
  caller: Profile | null | undefined,
  target: Pick<Profile, "papel"> | null | undefined,
): boolean {
  if (!caller || !target) return false;
  if (isAdmin(caller)) return true;
  if (!isGerente(caller)) return false;
  return target.papel === "gerente" || target.papel === "usuario";
}

/** Conta com senha temporária ainda não trocada pelo usuário. */
export function hasSenhaTemporaria(
  profile: Pick<Profile, "senha_temporaria"> | null | undefined,
): boolean {
  return !!profile?.senha_temporaria;
}

/** Prazo de 3 dias para troca já expirou (ainda assim exige definir nova senha). */
export function isSenhaTemporariaExpirada(
  profile: Pick<Profile, "senha_temporaria" | "senha_temporaria_expira_em"> | null | undefined,
): boolean {
  if (!profile?.senha_temporaria || !profile.senha_temporaria_expira_em) return false;
  return new Date(profile.senha_temporaria_expira_em).getTime() <= Date.now();
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

/** Qualquer perfil autenticado pode criar projeto. */
export function canCreateProjetos(profile: Profile | null | undefined): boolean {
  return !!profile;
}

type ProjetoEscopo = {
  criado_por: string | null;
  membros?: Array<{ usuario_id?: string; usuario?: { id: string } | null } | null> | null;
};

/** Criador ou membro adicionado manualmente. */
export function isProjetoParticipante(
  profile: Profile | null | undefined,
  projeto: ProjetoEscopo | null | undefined,
): boolean {
  if (!profile || !projeto) return false;
  if (projeto.criado_por === profile.id) return true;
  return (projeto.membros ?? []).some((m) => {
    if (!m) return false;
    return m.usuario_id === profile.id || m.usuario?.id === profile.id;
  });
}

/**
 * Visibilidade no menu Projetos:
 * - Administrador: todos os projetos
 * - Gestor / Usuário: apenas se for criador ou membro adicionado manualmente
 *
 * A filtragem efetiva é feita no RLS (`can_see_projeto`).
 */
export function canSeeProjeto(
  profile: Profile | null | undefined,
  projeto: ProjetoEscopo | null | undefined,
): boolean {
  if (!profile || !projeto) return false;
  if (isAdmin(profile)) return true;
  return isProjetoParticipante(profile, projeto);
}

/**
 * Edição / gestão do projeto (dados do formulário):
 * - Administrador: qualquer projeto
 * - Criador: o próprio projeto
 * - Gestor: apenas projetos em que participa
 */
export function canManageProjeto(
  profile: Profile | null | undefined,
  projeto: ProjetoEscopo | null | undefined,
): boolean {
  if (!profile || !projeto) return false;
  if (isAdmin(profile)) return true;
  if (projeto.criado_por === profile.id) return true;
  if (isGerente(profile)) return isProjetoParticipante(profile, projeto);
  return false;
}

/**
 * Exclusão de projeto:
 * - com atividades abertas (não concluídas): somente administrador;
 * - sem abertas: criador, gestor participante ou administrador.
 */
export function canDeleteProjeto(
  profile: Profile | null | undefined,
  projeto: ProjetoEscopo | null | undefined,
  hasOpenActivities: boolean,
): boolean {
  if (!profile || !projeto) return false;
  if (hasOpenActivities) return isAdmin(profile);
  return canManageProjeto(profile, projeto);
}

/** @deprecated Prefira `canDeleteProjeto` com contexto do projeto. */
export function canDeleteProjetos(profile: Profile | null | undefined): boolean {
  return isAdminOrGerente(profile);
}

/**
 * Adicionar/remover participantes:
 * - Criador: sempre (qualquer perfil)
 * - Administrador: qualquer projeto
 * - Gestor: apenas projetos em que participa (criador ou membro)
 * - Usuário não criador: não
 */
export function canManageProjetoMembros(
  profile: Profile | null | undefined,
  projeto: ProjetoEscopo | null | undefined,
): boolean {
  if (!profile || !projeto) return false;
  if (isAdmin(profile)) return true;
  if (projeto.criado_por === profile.id) return true;
  if (isGerente(profile)) return isProjetoParticipante(profile, projeto);
  return false;
}

export const PAPEL_LABELS: Record<Papel, string> = {
  admin: "Administrador",
  gerente: "Gestor",
  usuario: "Usuário",
  visualizador: "Visualizador",
};
