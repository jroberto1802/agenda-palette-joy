import { CalendarIcon, ChevronRight } from "lucide-react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import type { TarefaWithRelations } from "@/types";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";
import {
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_PRIORIDADE_LABELS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
  formatResponsaveisLabel,
  getTarefaResponsaveis,
} from "@/utils/tarefas";
import { cn } from "@/lib/utils";

export function TarefaListView({
  tarefas,
  onOpenTarefa,
}: {
  tarefas: TarefaWithRelations[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
}) {
  return (
    <div className="max-h-[min(70vh,720px)] overflow-y-auto rounded-xl border">
      <ul className="divide-y">
        {tarefas.map((tarefa) => (
          <TarefaListRow key={tarefa.id} tarefa={tarefa} onOpen={() => onOpenTarefa(tarefa)} />
        ))}
      </ul>
    </div>
  );
}

function TarefaListRow({
  tarefa,
  onOpen,
}: {
  tarefa: TarefaWithRelations;
  onOpen: () => void;
}) {
  const vencimentoVariant = getVencimentoVariant(tarefa.data_vencimento, tarefa.status);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "truncate text-sm font-medium",
              tarefa.status === "concluida" && "text-muted-foreground line-through",
            )}
          >
            {tarefa.titulo}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", TAREFA_STATUS_COLORS[tarefa.status])}
            >
              {TAREFA_STATUS_LABELS[tarefa.status]}
            </Badge>
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", TAREFA_PRIORIDADE_COLORS[tarefa.prioridade])}
            >
              {TAREFA_PRIORIDADE_LABELS[tarefa.prioridade]}
            </Badge>
            {getTarefaResponsaveis(tarefa).length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ProfileAvatar
                  name={getTarefaResponsaveis(tarefa)[0].nome_completo}
                  avatarUrl={getTarefaResponsaveis(tarefa)[0].avatar_url}
                  className="h-4 w-4"
                />
                <span className="max-w-[160px] truncate">{formatResponsaveisLabel(tarefa)}</span>
              </span>
            )}
            {tarefa.data_vencimento && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  vencimentoVariant === "destructive" && "text-destructive font-medium",
                  vencimentoVariant === "warning" && "font-medium text-amber-600 dark:text-amber-400",
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {formatDate(tarefa.data_vencimento)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
