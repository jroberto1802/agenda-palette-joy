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
  status: string,
): "default" | "warning" | "destructive" {
  if (!dataVencimento || status === "concluida") return "default";
  const date = parseISO(dataVencimento);
  if (isPast(date) && !isToday(date)) return "destructive";
  if (isToday(date)) return "warning";
  return "default";
}
