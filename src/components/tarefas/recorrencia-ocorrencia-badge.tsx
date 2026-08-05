import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Subtarefa, Tarefa } from "@/types";
import { parseDayLocal, toLocalDateKey } from "@/utils/agenda-datas";
import { isSerieOcorrencia } from "@/utils/recorrencia";

const BADGE_CLASS =
  "shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

type TarefaOcorrencia = Pick<
  Tarefa,
  "id" | "serie_raiz_id" | "data_inicio" | "recorrencia_data_origem"
>;

type SubtarefaOcorrencia = Pick<Subtarefa, "origem_subtarefa_id">;

/** Data prevista pela regra que gerou a ocorrência. */
export function getRecorrenciaOrigem(tarefa: TarefaOcorrencia): Date | null {
  if (!tarefa.recorrencia_data_origem) return null;
  return parseDayLocal(tarefa.recorrencia_data_origem);
}

/** Origem da recorrência somente quando a ocorrência foi reagendada para outro dia. */
export function getRecorrenciaOrigemReagendada(tarefa: TarefaOcorrencia): Date | null {
  const origem = getRecorrenciaOrigem(tarefa);
  if (!origem) return null;
  const origemKey = toLocalDateKey(origem);
  const atualKey = toLocalDateKey(tarefa.data_inicio);
  if (!origemKey || !atualKey || origemKey === atualKey) return null;
  return origem;
}

function buildTitle(tarefa: TarefaOcorrencia): string {
  const origem = getRecorrenciaOrigem(tarefa);
  if (!origem) return "Gerada por recorrência";
  const reagendada = getRecorrenciaOrigemReagendada(tarefa);
  if (!reagendada) return `Gerada pela recorrência de ${format(origem, "dd/MM/yyyy")}`;
  return `Origem da recorrência: ${format(origem, "dd/MM/yyyy")} · Reagendada para ${format(
    parseDayLocal(tarefa.data_inicio!),
    "dd/MM/yyyy",
  )}`;
}

/**
 * Identificação de ocorrência de série: ícone sempre, data de origem só quando a
 * ocorrência foi reagendada (a data exibida no card é a reagendada).
 *
 * Puramente informativo — não interfere na geração das próximas ocorrências.
 */
export function TarefaRecorrenciaBadge({
  tarefa,
  className,
  compact = false,
  detalhado = false,
}: {
  tarefa: TarefaOcorrencia;
  className?: string;
  /** Cards menores (Em breve / kanban compacto). */
  compact?: boolean;
  /** Painel de detalhe: mostra "Recorrência dd/MM/yyyy" sempre que houver origem. */
  detalhado?: boolean;
}) {
  if (!isSerieOcorrencia(tarefa)) return null;

  const origem = getRecorrenciaOrigem(tarefa);
  const reagendada = getRecorrenciaOrigemReagendada(tarefa);
  const label = detalhado
    ? origem
      ? `Recorrência ${format(origem, "dd/MM/yyyy")}`
      : "Recorrência"
    : reagendada
      ? format(reagendada, "dd/MM")
      : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        BADGE_CLASS,
        compact ? "gap-0.5 px-1 py-0 text-[9px]" : "gap-1 px-1.5 py-0 text-[10px]",
        className,
      )}
      title={buildTitle(tarefa)}
    >
      <RefreshCw className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {label ? (
        <span className="tabular-nums">{label}</span>
      ) : (
        <span className="sr-only">Gerada por recorrência</span>
      )}
    </Badge>
  );
}

/** Subtarefa clonada de um template de série (`origem_subtarefa_id`). */
export function SubtarefaRecorrenciaBadge({
  subtarefa,
  className,
  compact = false,
}: {
  subtarefa: SubtarefaOcorrencia;
  className?: string;
  compact?: boolean;
}) {
  if (!subtarefa.origem_subtarefa_id) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        BADGE_CLASS,
        compact ? "gap-0.5 px-1 py-0 text-[9px]" : "gap-1 px-1.5 py-0 text-[10px]",
        className,
      )}
      title="Subtarefa gerada por recorrência"
    >
      <RefreshCw className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      <span className="sr-only">Gerada por recorrência</span>
    </Badge>
  );
}
