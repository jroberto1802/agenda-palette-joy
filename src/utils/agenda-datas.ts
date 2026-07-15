import {
  addDays,
  format,
  parse,
  startOfDay,
  startOfMonth,
  isSameMonth,
  isSameDay,
} from "date-fns";

/** YYYY-MM-DD no fuso local. */
export function toLocalDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd");
}

export function startOfTodayLocal(): Date {
  return startOfDay(new Date());
}

/** Meio-dia local — evita deslocamento de dia ao serializar ISO. */
export function localDateAtNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function localDateKeyAtNoon(dateKey: string): Date {
  const parsed = parse(dateKey, "yyyy-MM-dd", new Date());
  return localDateAtNoon(parsed);
}

/** Limites ISO inclusivos para filtrar `data_inicio` por dia(s) local(is). */
export function localDateRangeToIsoBounds(de: string, ate: string): {
  startIso: string;
  endIso: string;
} {
  const start = parse(de, "yyyy-MM-dd", new Date());
  const end = parse(ate, "yyyy-MM-dd", new Date());
  const startLocal = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    0,
    0,
    0,
    0,
  );
  const endLocal = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
    23,
    59,
    59,
    999,
  );
  return { startIso: startLocal.toISOString(), endIso: endLocal.toISOString() };
}

export const AGENDA_EM_BREVE_PAGE_SIZE = 4;

export function getEmBreveDays(windowStart: Date, size = AGENDA_EM_BREVE_PAGE_SIZE): Date[] {
  const base = startOfDay(windowStart);
  return Array.from({ length: size }, (_, i) => addDays(base, i));
}

/** Ao trocar o mês no seletor: mês atual → hoje; outro mês → dia 1. */
export function resolveWindowStartForMonth(month: Date, today = startOfTodayLocal()): Date {
  const m = startOfMonth(month);
  if (isSameMonth(m, today)) return today;
  return m;
}

export function tarefaMatchesLocalDate(
  dataInicio: string | null | undefined,
  day: Date,
): boolean {
  const key = toLocalDateKey(dataInicio);
  if (!key) return false;
  return isSameDay(parse(key, "yyyy-MM-dd", new Date()), startOfDay(day));
}
