import { addDays, addMonths, addWeeks, format, isAfter, parseISO, startOfDay } from "date-fns";

export type RecorrenciaTipo = "nenhuma" | "diaria" | "semanal" | "mensal";

export type RecorrenciaConfig = {
  tipo: RecorrenciaTipo;
  dias_semana?: number[];
  dia_mes?: number;
  data_fim?: string | null;
};

export const RECORRENCIA_LABELS: Record<RecorrenciaTipo, string> = {
  nenhuma: "Sem recorrência",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
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
  return {
    tipo,
    dias_semana: Array.isArray(r.dias_semana) ? (r.dias_semana as number[]) : undefined,
    dia_mes: typeof r.dia_mes === "number" ? r.dia_mes : undefined,
    data_fim: typeof r.data_fim === "string" ? r.data_fim : null,
  };
}

export function serializeRecorrencia(config: RecorrenciaConfig | null): RecorrenciaConfig | null {
  if (!config || config.tipo === "nenhuma") return null;
  return config;
}

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
    default:
      return null;
  }
}

export function deveGerarProximaOcorrencia(config: RecorrenciaConfig, proximaData: Date): boolean {
  if (!config.data_fim) return true;
  return !isAfter(proximaData, startOfDay(parseISO(config.data_fim)));
}

export function formatRecorrencia(config: RecorrenciaConfig | null): string {
  if (!config || config.tipo === "nenhuma") return "Sem recorrência";
  const fim = config.data_fim ? ` até ${format(parseISO(config.data_fim), "dd/MM/yyyy")}` : "";
  switch (config.tipo) {
    case "diaria":
      return `Diária${fim}`;
    case "semanal": {
      const labels = (config.dias_semana ?? [])
        .map((d) => DIAS_SEMANA.find((x) => x.value === d)?.label)
        .filter(Boolean)
        .join(", ");
      return `Semanal (${labels || "—"})${fim}`;
    }
    case "mensal":
      return `Mensal (dia ${config.dia_mes ?? "—"})${fim}`;
    default:
      return "Sem recorrência";
  }
}
