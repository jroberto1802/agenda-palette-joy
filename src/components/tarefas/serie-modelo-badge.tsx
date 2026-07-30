import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TarefaWithRelations } from "@/types";
import { formatDate } from "@/utils/formatters";
import {
  formatRecorrencia,
  isSerieModelo,
  parseRecorrencia,
} from "@/utils/recorrencia";

/** Badge/resumo do Modelo da Série (próxima ocorrência + regra). */
export function SerieModeloBadge({
  tarefa,
  className,
  compact = false,
}: {
  tarefa: TarefaWithRelations;
  className?: string;
  compact?: boolean;
}) {
  if (!isSerieModelo(tarefa)) return null;

  const regra = formatRecorrencia(parseRecorrencia(tarefa.recorrencia));
  const proxima = tarefa.data_inicio ? formatDate(tarefa.data_inicio) : null;

  if (compact) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
          className,
        )}
        title={
          proxima
            ? `Próxima ocorrência: ${proxima} • ${regra}`
            : regra
        }
      >
        <RefreshCw className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        {proxima ? `Próx. ${proxima}` : regra}
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "space-y-0.5 text-[11px] leading-snug text-muted-foreground",
        className,
      )}
    >
      {proxima && (
        <p className="font-medium text-foreground/80">Próxima ocorrência: {proxima}</p>
      )}
      <p className="truncate" title={regra}>
        {regra}
      </p>
    </div>
  );
}
