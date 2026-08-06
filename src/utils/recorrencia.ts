import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import type { RecorrenciaConfig, RecorrenciaTipo, RecorrenciaUnidade } from "@/types";
import { parseDayLocal, toLocalDateKey } from "@/utils/agenda-datas";

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

/** Meses do ano (1–12) para recorrência anual. */
export const MESES_ANO = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

/** Data civil no ano informado (mês 1–12); dia inválido é limitado ao último dia do mês. */
export function dataAnualNoAno(year: number, mes: number, dia: number): Date {
  const m = Math.min(Math.max(mes, 1), 12);
  const lastDay = new Date(year, m, 0).getDate();
  const d = Math.min(Math.max(dia, 1), lastDay);
  return startOfDay(new Date(year, m - 1, d));
}

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
    mes: typeof r.mes === "number" ? r.mes : undefined,
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

/** Janela máxima de previsão futura exibida em "Em breve" e no Calendário. */
export const PREVISAO_LIMITE_ANOS = 1;

/**
 * Último instante com previsão de ocorrência futura (hoje + 1 ano).
 *
 * Limite de exibição/cálculo apenas: a série continua ativa indefinidamente,
 * e a previsão reaparece quando a data entra na janela.
 */
export function getLimitePrevisaoFutura(hoje: Date = new Date()): Date {
  return endOfDay(addYears(startOfDay(hoje), PREVISAO_LIMITE_ANOS));
}

function withinEnd(date: Date, config: RecorrenciaConfig): boolean {
  if (!config.data_fim) return true;
  return !isAfter(startOfDay(date), parseDayLocal(config.data_fim));
}

/** Próxima data estritamente após `dataAtual` (ISO, YYYY-MM-DD ou null). */
export function calcularProximaData(
  dataAtual: string | null,
  config: RecorrenciaConfig,
): Date | null {
  const from = dataAtual ? parseDayLocal(dataAtual) : startOfDay(new Date());

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
      // Primeira data válida estritamente após `from`: se o dia configurado
      // ainda ocorrer neste mês, usa o mês vigente; senão, o mês seguinte.
      const dia = Math.min(Math.max(config.dia_mes ?? from.getDate(), 1), 28);
      const noMesAtual = new Date(from.getFullYear(), from.getMonth(), dia);
      if (isAfter(startOfDay(noMesAtual), startOfDay(from))) {
        return noMesAtual;
      }
      const next = addMonths(new Date(from.getFullYear(), from.getMonth(), 1), 1);
      next.setDate(dia);
      return next;
    }
    case "anual": {
      const n = config.intervalo && config.intervalo > 0 ? config.intervalo : 1;
      // Sem dia/mês explícitos: comportamento legado (mesma data civil + N anos).
      if (config.mes == null && config.dia_mes == null) {
        return addYears(from, n);
      }
      const mes = Math.min(Math.max(config.mes ?? from.getMonth() + 1, 1), 12);
      const dia = Math.min(Math.max(config.dia_mes ?? from.getDate(), 1), 31);
      const nesteAno = dataAnualNoAno(from.getFullYear(), mes, dia);
      if (isAfter(nesteAno, startOfDay(from))) {
        return nesteAno;
      }
      return dataAnualNoAno(from.getFullYear() + n, mes, dia);
    }
    case "personalizada": {
      if (config.datas_livres?.length) {
        const sorted = [...config.datas_livres].sort();
        const fromKey = toLocalDateKey(from)!;
        const nextKey = sorted.find((d) => d > fromKey);
        return nextKey ? parseDayLocal(nextKey) : null;
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
 * Indica se `date` realmente satisfaz a periodicidade da regra (dia da
 * semana em "semanal", dia do mês em "mensal"). Usado para não aceitar a
 * âncora/cursor como ocorrência válida quando ela não corresponde ao dia
 * configurado (ex.: âncora numa quarta-feira numa regra "toda quinta").
 */
function combinaComRegra(date: Date, config: RecorrenciaConfig): boolean {
  switch (config.tipo) {
    case "semanal": {
      const dias = config.dias_semana?.length ? config.dias_semana : null;
      if (!dias) return true;
      return dias.includes(date.getDay());
    }
    case "mensal": {
      const dia = config.dia_mes ?? date.getDate();
      return date.getDate() === Math.min(Math.max(dia, 1), 28);
    }
    case "anual": {
      // Legado sem dia/mês: qualquer data serve como âncora.
      if (config.mes == null && config.dia_mes == null) return true;
      const mes = Math.min(Math.max(config.mes ?? date.getMonth() + 1, 1), 12);
      const dia = Math.min(Math.max(config.dia_mes ?? date.getDate(), 1), 31);
      return isSameDay(date, dataAnualNoAno(date.getFullYear(), mes, dia));
    }
    default:
      return true;
  }
}

/**
 * Próxima ocorrência prevista a partir de hoje (ou de `aPartirDe`).
 * Se a âncora ainda é futura E satisfaz a regra, retorna a âncora.
 */
export function calcularProximaOcorrenciaPrevista(
  ancora: string | null,
  config: RecorrenciaConfig,
  aPartirDe: Date = new Date(),
): Date | null {
  const limite = startOfDay(aPartirDe);
  let cursor = ancora ? parseDayLocal(ancora) : limite;

  if (!isBefore(cursor, limite) && withinEnd(cursor, config) && combinaComRegra(cursor, config)) {
    return cursor;
  }

  let guard = 0;
  while (guard < 5000) {
    const next = calcularProximaData(toLocalDateKey(cursor), config);
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
      const d = parseDayLocal(key);
      if (isBefore(d, rangeStart) || isAfter(d, rangeEnd)) continue;
      if (!withinEnd(d, config)) continue;
      results.push(d);
      if (results.length >= max) break;
    }
    return results;
  }

  let cursor = ancora ? parseDayLocal(ancora) : rangeStart;

  // Avança até estar dentro da janela pedida E satisfazer a regra (dia da
  // semana / dia do mês) — sem essa checagem, a âncora era aceita como
  // ocorrência mesmo quando não correspondia ao dia configurado.
  let guard = 0;
  while (
    (isBefore(cursor, rangeStart) || !combinaComRegra(cursor, config)) &&
    guard < 5000
  ) {
    const next = calcularProximaData(toLocalDateKey(cursor), config);
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
    const next = calcularProximaData(toLocalDateKey(cursor), config);
    if (!next || !deveGerarProximaOcorrencia(config, next)) break;
    cursor = startOfDay(next);
    if (isAfter(cursor, rangeEnd)) break;
    if (!isBefore(cursor, rangeStart)) results.push(cursor);
  }

  return results;
}

export function formatRecorrencia(config: RecorrenciaConfig | null): string {
  if (!config || config.tipo === "nenhuma") return "Nenhuma";
  const fim = config.data_fim
    ? ` até ${format(parseDayLocal(config.data_fim), "dd/MM/yyyy")}`
    : "";

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
      const mesLabel =
        config.mes != null
          ? MESES_ANO.find((m) => m.value === config.mes)?.label
          : undefined;
      const dataPart =
        config.dia_mes != null && mesLabel
          ? ` • ${config.dia_mes} de ${mesLabel}`
          : "";
      if (n === 1) return `Anual${dataPart}${fim}`;
      return `Anual • A cada ${n} anos${dataPart}${fim}`;
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
  if (parsed?.data_ancora) return toLocalDateKey(parsed.data_ancora) ?? parsed.data_ancora;
  return toLocalDateKey(modelo.data_inicio) ?? modelo.data_inicio ?? null;
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

  let parentDay: Date;
  if (ancoraKey) {
    const ocorrencias = expandirDatasOcorrencia(
      ancoraKey,
      config,
      parseDayLocal(ancoraKey),
      subDay,
      { max: 600 },
    );
    parentDay =
      ocorrencias.length > 0
        ? ocorrencias[ocorrencias.length - 1]!
        : parseDayLocal(ancoraKey);
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

/** Tipos que usam campo Dia (1–31) nas subtarefas do modelo. */
export function isRecorrenciaMensalLike(config: RecorrenciaConfig | null): boolean {
  if (!config) return false;
  if (config.tipo === "mensal" || config.tipo === "anual") return true;
  return config.tipo === "personalizada" && (config.datas_livres?.length ?? 0) > 0;
}

/**
 * Data civil da subtarefa numa ocorrência do pai (Dia fixo, offset explícito ou legado).
 */
export function dataSubtarefaNaOcorrencia(
  ocorrenciaPai: Date,
  config: RecorrenciaConfig,
  subtarefa: {
    data_inicio?: string | null;
    dia_no_mes?: number | null;
    offset_dias?: number | null;
  },
  ancora: string | null,
): Date | null {
  const paiDay = startOfDay(ocorrenciaPai);

  if (subtarefa.dia_no_mes != null && isRecorrenciaMensalLike(config)) {
    const year = paiDay.getFullYear();
    const month = paiDay.getMonth();
    const last = new Date(year, month + 1, 0).getDate();
    const day = Math.min(subtarefa.dia_no_mes, last);
    return new Date(year, month, day, 12, 0, 0, 0);
  }

  if (subtarefa.offset_dias != null) {
    return addDays(paiDay, subtarefa.offset_dias);
  }

  // Diária: deslocamento não é configurável (campo oculto) — assume-se
  // sempre o mesmo dia da ocorrência pai.
  if (config.tipo === "diaria") {
    return paiDay;
  }

  const offset = offsetDiasSubtarefaNoCiclo(subtarefa.data_inicio, ancora, config);
  if (offset == null) return null;
  return addDays(paiDay, offset);
}

export function sameCalendarDay(a: string | null | undefined, b: Date): boolean {
  const key = toLocalDateKey(a);
  if (!key) return false;
  return isSameDay(parseDayLocal(key), b);
}
