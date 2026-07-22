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
        className={cn("gap-1 px-1.5 py-0 text-[10px]", className)}
        title={
          proxima
            ? `Modelo da série • Próxima: ${proxima} • ${regra}`
            : `Modelo da série • ${regra}`
        }
      >
        <RefreshCw className="h-3 w-3" />
        Série
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "mt-1 space-y-0.5 text-[11px] leading-snug text-muted-foreground",
        className,
      )}
    >
      <p className="inline-flex items-center gap-1 font-medium text-foreground/80">
        <RefreshCw className="h-3 w-3" />
        Modelo da série
      </p>
      {proxima && <p>Próxima ocorrência: {proxima}</p>}
      <p>Recorrência: {regra}</p>
    </div>
  );
}
