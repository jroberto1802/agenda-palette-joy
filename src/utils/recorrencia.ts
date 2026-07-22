import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import type { RecorrenciaConfig, RecorrenciaTipo, RecorrenciaUnidade } from "@/types";
import { toLocalDateKey } from "@/utils/agenda-datas";

export type { RecorrenciaConfig, RecorrenciaTipo, RecorrenciaUnidade };

export const RECORRENCIA_LABELS: Record<RecorrenciaTipo, string> = {
  nenhuma: "Nenhuma",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  anual: "Anual",
  personalizada: "Personalizada",
};

export const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function parseRecorrencia(raw: unknown): RecorrenciaConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tipo = r.tipo as RecorrenciaTipo;
  if (!tipo || tipo === "nenhuma") return null;

  const unidade =
    r.unidade === "dias" || r.unidade === "semanas" || r.unidade === "meses"
      ? r.unidade
      : undefined;

  return {
    tipo,
    dias_semana: Array.isArray(r.dias_semana) ? (r.dias_semana as number[]) : undefined,
    dia_mes: typeof r.dia_mes === "number" ? r.dia_mes : undefined,
    intervalo: typeof r.intervalo === "number" && r.intervalo > 0 ? r.intervalo : undefined,
    unidade,
    datas_livres: Array.isArray(r.datas_livres)
      ? (r.datas_livres as string[]).filter((d) => typeof d === "string")
      : undefined,
    data_ancora: typeof r.data_ancora === "string" ? r.data_ancora : null,
    data_fim: typeof r.data_fim === "string" ? r.data_fim : null,
  };
}

export function serializeRecorrencia(config: RecorrenciaConfig | null): RecorrenciaConfig | null {
  if (!config || config.tipo === "nenhuma") return null;
  return config;
}

/** Modelo permanente da série (`serie_raiz_id === id`). */
export function isSerieModelo(
  tarefa: { id: string; serie_raiz_id?: string | null },
): boolean {
  return !!tarefa.serie_raiz_id && tarefa.serie_raiz_id === tarefa.id;
}

/** Ocorrência materializada (`serie_raiz_id` aponta para o modelo). */
export function isSerieOcorrencia(
  tarefa: { id: string; serie_raiz_id?: string | null },
): boolean {
  return !!tarefa.serie_raiz_id && tarefa.serie_raiz_id !== tarefa.id;
}

export function pertenceASerie(
  tarefa: { serie_raiz_id?: string | null },
): boolean {
  return !!tarefa.serie_raiz_id;
}

function withinEnd(date: Date, config: RecorrenciaConfig): boolean {
  if (!config.data_fim) return true;
  return !isAfter(startOfDay(date), startOfDay(parseISO(config.data_fim)));
}

/** Próxima data estritamente após `dataAtual` (ISO ou null). */
export function calcularProximaData(
  dataAtual: string | null,
  config: RecorrenciaConfig,
): Date | null {
  const base = dataAtual ? parseISO(dataAtual) : new Date();
  const from = startOfDay(base);

  switch (config.tipo) {
    case "diaria":
      return addDays(from, 1);
    case "semanal": {
      const dias = config.dias_semana?.length ? config.dias_semana : [from.getDay()];
      for (let i = 1; i <= 14; i++) {
        const candidate = addDays(from, i);
        if (dias.includes(candidate.getDay())) return candidate;
      }
      return addWeeks(from, 1);
    }
    case "mensal": {
      const dia = config.dia_mes ?? from.getDate();
      const next = addMonths(from, 1);
      next.setDate(Math.min(dia, 28));
      return next;
    }
    case "anual": {
      const n = config.intervalo && config.intervalo > 0 ? config.intervalo : 1;
      return addYears(from, n);
    }
    case "personalizada": {
      if (config.datas_livres?.length) {
        const sorted = [...config.datas_livres].sort();
        const fromKey = toLocalDateKey(from)!;
        const nextKey = sorted.find((d) => d > fromKey);
        return nextKey ? startOfDay(parseISO(nextKey)) : null;
      }
      const n = config.intervalo && config.intervalo > 0 ? config.intervalo : 1;
      if (config.unidade === "semanas") return addWeeks(from, n);
      if (config.unidade === "meses") return addMonths(from, n);
      return addDays(from, n);
    }
    default:
      return null;
  }
}

export function deveGerarProximaOcorrencia(config: RecorrenciaConfig, proximaData: Date): boolean {
  return withinEnd(proximaData, config);
}

/**
 * Próxima ocorrência prevista a partir de hoje (ou de `aPartirDe`).
 * Se a âncora ainda é futura, retorna a âncora.
 */
export function calcularProximaOcorrenciaPrevista(
  ancora: string | null,
  config: RecorrenciaConfig,
  aPartirDe: Date = new Date(),
): Date | null {
  const limite = startOfDay(aPartirDe);
  let cursor = ancora ? startOfDay(parseISO(ancora)) : limite;

  if (!isBefore(cursor, limite) && withinEnd(cursor, config)) {
    return cursor;
  }

  let guard = 0;
  while (guard < 5000) {
    const next = calcularProximaData(cursor.toISOString(), config);
    if (!next || !deveGerarProximaOcorrencia(config, next)) return null;
    cursor = startOfDay(next);
    if (!isBefore(cursor, limite)) return cursor;
    guard++;
  }
  return null;
}

/**
 * Expande datas de ocorrência no intervalo [de, ate] (inclusive),
 * a partir da âncora (data âncora da série — tipicamente a primeira data).
 */
export function expandirDatasOcorrencia(
  ancora: string | null,
  config: RecorrenciaConfig,
  de: Date,
  ate: Date,
  options?: { max?: number },
): Date[] {
  const max = options?.max ?? 366;
  const rangeStart = startOfDay(de);
  const rangeEnd = startOfDay(ate);
  const results: Date[] = [];

  if (config.tipo === "personalizada" && config.datas_livres?.length) {
    for (const key of [...config.datas_livres].sort()) {
      const d = startOfDay(parseISO(key));
      if (isBefore(d, rangeStart) || isAfter(d, rangeEnd)) continue;
      if (!withinEnd(d, config)) continue;
      results.push(d);
      if (results.length >= max) break;
    }
    return results;
  }

  let cursor = ancora ? startOfDay(parseISO(ancora)) : rangeStart;

  let guard = 0;
  while (isBefore(cursor, rangeStart) && guard < 5000) {
    const next = calcularProximaData(cursor.toISOString(), config);
    if (!next || !deveGerarProximaOcorrencia(config, next)) return results;
    cursor = startOfDay(next);
    guard++;
  }

  if (
    !isBefore(cursor, rangeStart) &&
    !isAfter(cursor, rangeEnd) &&
    withinEnd(cursor, config)
  ) {
    results.push(cursor);
  }

  while (results.length < max) {
    const next = calcularProximaData(cursor.toISOString(), config);
    if (!next || !deveGerarProximaOcorrencia(config, next)) break;
    cursor = startOfDay(next);
    if (isAfter(cursor, rangeEnd)) break;
    if (!isBefore(cursor, rangeStart)) results.push(cursor);
  }

  return results;
}

export function formatRecorrencia(config: RecorrenciaConfig | null): string {
  if (!config || config.tipo === "nenhuma") return "Nenhuma";
  const fim = config.data_fim ? ` até ${format(parseISO(config.data_fim), "dd/MM/yyyy")}` : "";

  switch (config.tipo) {
    case "diaria":
      return `Diária${fim}`;
    case "semanal": {
      const labels = (config.dias_semana ?? [])
        .map((d) => DIAS_SEMANA.find((x) => x.value === d)?.label)
        .filter(Boolean)
        .join(", ");
      return labels ? `Semanal • Toda ${labels}${fim}` : `Semanal${fim}`;
    }
    case "mensal":
      return `Mensal • Dia ${config.dia_mes ?? "—"}${fim}`;
    case "anual": {
      const n = config.intervalo && config.intervalo > 0 ? config.intervalo : 1;
      if (n === 1) return `Anual${fim}`;
      return `Anual • A cada ${n} anos${fim}`;
    }
    case "personalizada": {
      if (config.datas_livres?.length) {
        return `Personalizada • ${config.datas_livres.length} data(s)${fim}`;
      }
      const n = config.intervalo ?? 1;
      const unidade =
        config.unidade === "semanas"
          ? n === 1
            ? "semana"
            : "semanas"
          : config.unidade === "meses"
            ? n === 1
              ? "mês"
              : "meses"
            : n === 1
              ? "dia"
              : "dias";
      return `Personalizada • A cada ${n} ${unidade}${fim}`;
    }
    default:
      return "Nenhuma";
  }
}

/** Âncora estável da série (data_ancora na regra ou data_inicio do modelo). */
export function getAncoraSerie(
  modelo: { data_inicio?: string | null; recorrencia?: unknown },
  config?: RecorrenciaConfig | null,
): string | null {
  const parsed = config ?? parseRecorrencia(modelo.recorrencia);
  if (parsed?.data_ancora) return parsed.data_ancora;
  return toLocalDateKey(modelo.data_inicio) ?? modelo.data_inicio ?? null;
}

function parseDayLocal(isoOrKey: string): Date {
  if (isoOrKey.includes("T")) return startOfDay(new Date(isoOrKey));
  return startOfDay(new Date(`${isoOrKey}T12:00:00`));
}

/**
 * Offset em dias da subtarefa-template em relação à ocorrência da tarefa
 * no mesmo ciclo (última ocorrência da série em/antes da data da subtarefa).
 *
 * Subtarefas NÃO têm recorrência própria — só um deslocamento fixo (+0, +1, +2…)
 * aplicado a cada ocorrência da tarefa principal.
 */
export function offsetDiasSubtarefaNoCiclo(
  subtarefaDataInicio: string | null | undefined,
  ancora: string | null,
  config: RecorrenciaConfig,
): number | null {
  if (!subtarefaDataInicio) return null;

  const subDay = parseDayLocal(subtarefaDataInicio);
  const ancoraKey = ancora ? toLocalDateKey(ancora) ?? ancora : null;
  const ancoraIso = ancoraKey ? `${ancoraKey}T12:00:00` : null;

  let parentDay: Date;
  if (ancoraIso) {
    const ocorrencias = expandirDatasOcorrencia(
      ancoraIso,
      config,
      parseDayLocal(ancoraIso),
      subDay,
      { max: 600 },
    );
    parentDay =
      ocorrencias.length > 0
        ? ocorrencias[ocorrencias.length - 1]!
        : parseDayLocal(ancoraIso);
  } else {
    parentDay = subDay;
  }

  const offset = Math.round(
    (subDay.getTime() - parentDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  // Deslocamentos típicos de subtarefa dentro do ciclo (não meses à frente)
  if (offset < 0 || offset > 31) return null;
  return offset;
}

export function sameCalendarDay(a: string | null | undefined, b: Date): boolean {
  const key = toLocalDateKey(a);
  if (!key) return false;
  return isSameDay(parseISO(key), b);
}
