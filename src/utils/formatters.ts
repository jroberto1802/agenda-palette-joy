import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return format(parseISO(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function getVencimentoVariant(
  dataVencimento: string | null | undefined,
  concluida: boolean,
): "default" | "warning" | "destructive" {
  if (!dataVencimento || concluida) return "default";
  const date = parseISO(dataVencimento);
  if (isPast(date) && !isToday(date)) return "destructive";
  if (isToday(date)) return "warning";
  return "default";
}

const FUSO_BRASILIA = "America/Sao_Paulo";

const dataHoraBrasiliaFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_BRASILIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * "DD/MM/AAAA às HH:MM" no horário de Brasília (24h), independente do fuso do navegador.
 * Valor só com data (YYYY-MM-DD, sem hora registrada) → apenas "DD/MM/AAAA".
 * Sem valor / inválido → null.
 */
export function formatDataHoraBrasilia(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [ano, mes, dia] = value.trim().split("-");
    return `${dia}/${mes}/${ano}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    dataHoraBrasiliaFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}

/**
 * Texto do tooltip de autoria: "Criado por Fulano em 10/11/2026 às 14:30" /
 * "Concluído por Fulano em ...". Sem data registrada, mostra só o nome.
 */
export function formatAutoriaTooltip(params: {
  acao: "Criado" | "Concluído";
  nome: string;
  quando?: string | Date | null;
  ativo?: boolean | null;
}): string {
  const quando = formatDataHoraBrasilia(params.quando);
  const desativada = params.ativo === false ? " (desativada)" : "";
  return `${params.acao} por ${params.nome}${desativada}${quando ? ` em ${quando}` : ""}`;
}
