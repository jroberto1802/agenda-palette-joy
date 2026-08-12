import { differenceInCalendarDays, isPast } from "date-fns";
import type { Aviso, AvisoPrioridade, AvisoWithRelations } from "@/types";

export const AVISO_ALCANCE_LABELS = {
  todos: "Todos",
  por_setor: "Por setor",
  pessoa_especifica: "Pessoas específicas",
} as const;

export const AVISO_PRIORIDADE_LABELS: Record<AvisoPrioridade, string> = {
  urgente: "Urgente",
  importante: "Importante",
  informativo: "Informativo",
  geral: "Geral",
};

export const AVISO_PRIORIDADE_BAND_CLASS: Record<AvisoPrioridade, string> = {
  urgente: "border-l-red-500",
  importante: "border-l-orange-500",
  informativo: "border-l-blue-500",
  geral: "border-l-green-500",
};

export const AVISO_PRIORIDADE_BADGE_CLASS: Record<AvisoPrioridade, string> = {
  urgente: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  importante:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  informativo:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  geral:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
};

export function isAvisoFinalizado(aviso: Pick<Aviso, "data_expiracao">): boolean {
  return isPast(new Date(aviso.data_expiracao));
}

export function isAvisoAtivo(aviso: Pick<Aviso, "data_expiracao">): boolean {
  return !isAvisoFinalizado(aviso);
}

export function formatAvisoExpiracao(dataExpiracao: string): string {
  const expiracao = new Date(dataExpiracao);
  if (isPast(expiracao)) return "Expirado";

  const dias = differenceInCalendarDays(expiracao, new Date());
  if (dias === 0) return "Expira hoje";
  if (dias === 1) return "Expira amanhã";
  return `Expira em ${dias} dias`;
}

export function matchesAvisoSearch(aviso: Pick<Aviso, "titulo" | "conteudo">, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return (
    aviso.titulo.toLowerCase().includes(normalized) ||
    aviso.conteudo.toLowerCase().includes(normalized)
  );
}

export function getAvisoDestinatarioLabel(aviso: AvisoWithRelations): string {
  if (aviso.alcance === "todos") return "Todos";
  if (aviso.alcance === "por_setor") {
    const nomes = aviso.setores.map((item) => item.setor?.nome).filter(Boolean);
    return nomes.length ? nomes.join(", ") : "Setor";
  }
  const nomes = aviso.pessoas.map((item) => item.usuario?.nome_completo).filter(Boolean);
  return nomes.length ? nomes.join(", ") : "Pessoas específicas";
}

export function getAvisoDestinatariosPessoas(
  aviso: AvisoWithRelations,
): Array<{
  id: string;
  nome_completo: string;
  avatar_url: string | null;
  ativo?: boolean | null;
}> {
  return aviso.pessoas
    .map((item) => item.usuario)
    .filter((usuario): usuario is NonNullable<typeof usuario> => !!usuario)
    .map((usuario) => ({
      id: usuario.id,
      nome_completo: usuario.nome_completo,
      avatar_url: usuario.avatar_url ?? null,
      ativo: usuario.ativo,
    }));
}
