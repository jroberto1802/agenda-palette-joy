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

/**
 * Interpreta YYYY-MM-DD (ou ISO com hora) como início do dia local.
 * Evita o bug de `parseISO("YYYY-MM-DD")` (UTC midnight → dia anterior no Brasil).
 */
export function parseDayLocal(isoOrKey: string): Date {
  if (isoOrKey.includes("T")) return startOfDay(new Date(isoOrKey));
  return startOfDay(new Date(`${isoOrKey}T12:00:00`));
}

/**
 * Data sem horário explícito é normalizada para 12:00 local.
 * Horário explícito = qualquer hora/minuto diferente de 12:00.
 */
export function hasExplicitTime(date: Date | null | undefined): boolean {
  if (!date || Number.isNaN(date.getTime())) return false;
  return !(date.getHours() === 12 && date.getMinutes() === 0);
}

/** Valor `HH:mm` para input type="time", ou string vazia se sem horário. */
export function getTimeInputValue(date: Date | null | undefined): string {
  if (!date || !hasExplicitTime(date)) return "";
  return format(date, "HH:mm");
}

/** Aplica HH:mm na data (mantém o dia). Se `time` for vazio, volta para meio-dia (sem hora). */
export function applyTimeToDate(date: Date, time: string | null | undefined): Date {
  if (!time) return localDateAtNoon(date);
  const [hRaw, mRaw] = time.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return localDateAtNoon(date);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  );
}

/** Troca o dia preservando horário explícito (ou meio-dia se não houver). */
export function replaceDateKeepingTime(
  previous: Date | null,
  nextDay: Date,
): Date {
  if (previous && hasExplicitTime(previous)) {
    return applyTimeToDate(nextDay, getTimeInputValue(previous));
  }
  return localDateAtNoon(nextDay);
}

/** Copia hora/minuto de `sourceIso` para o dia de `day`. */
export function applyTimeFromIso(day: Date, sourceIso: string | null | undefined): Date {
  if (!sourceIso) return localDateAtNoon(day);
  const src = new Date(sourceIso);
  if (Number.isNaN(src.getTime())) return localDateAtNoon(day);
  if (!hasExplicitTime(src)) return localDateAtNoon(day);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    src.getHours(),
    src.getMinutes(),
    0,
    0,
  );
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
