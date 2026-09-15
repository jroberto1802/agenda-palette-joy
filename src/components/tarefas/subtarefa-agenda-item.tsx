import { DescricaoPreview } from "@/components/tarefas/descricao-preview";
import { ConclusaoBolinha } from "@/components/tarefas/conclusao-bolinha";
import { SubtarefaRecorrenciaBadge } from "@/components/tarefas/recorrencia-ocorrencia-badge";
import { Badge } from "@/components/ui/badge";
import { ITEM_CONCLUIDO_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { SubtarefaAgendaItem } from "@/types";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";
import {
  TAREFA_PRIORIDADE_BAND_CLASS,
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_PRIORIDADE_LABELS,
} from "@/utils/tarefas";
import { AlertTriangle, CalendarIcon, ChevronRight, ListTodo } from "lucide-react";
import { memo, type ReactNode } from "react";

export const SubtarefaAgendaListRow = memo(function SubtarefaAgendaListRow({
  subtarefa,
  onOpen,
  onToggleConcluida,
  actions,
  showAtrasadaBadge = false,
}: {
  subtarefa: SubtarefaAgendaItem;
  onOpen: () => void;
  onToggleConcluida?: (concluida: boolean) => void | Promise<void>;
  actions?: ReactNode;
  showAtrasadaBadge?: boolean;
}) {
  const vencimentoVariant = getVencimentoVariant(subtarefa.data_inicio, subtarefa.concluida);
  const parentTitle = subtarefa.tarefa?.titulo?.trim() || "Tarefa principal";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-l-4 bg-card px-2 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 sm:gap-3 sm:px-4",
        TAREFA_PRIORIDADE_BAND_CLASS[subtarefa.prioridade],
        subtarefa.concluida && ITEM_CONCLUIDO_CLASS,
      )}
    >
      {onToggleConcluida && (
        <ConclusaoBolinha
          concluida={subtarefa.concluida}
          kind="subtarefa"
          onToggle={onToggleConcluida}
        />
      )}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-1 text-left">
        <p className="truncate text-sm font-medium">{subtarefa.titulo}</p>
        <DescricaoPreview descricao={subtarefa.descricao} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {showAtrasadaBadge && (
            <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              Atrasada
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
            <ListTodo className="h-3 w-3" />
            Subtarefa
          </Badge>
          <Badge
            variant="outline"
            className={cn("px-1.5 py-0 text-[10px]", TAREFA_PRIORIDADE_COLORS[subtarefa.prioridade])}
          >
            {TAREFA_PRIORIDADE_LABELS[subtarefa.prioridade]}
          </Badge>
          <SubtarefaRecorrenciaBadge subtarefa={subtarefa} />
          <span className="truncate">de: {parentTitle}</span>
          {subtarefa.data_inicio && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                vencimentoVariant === "destructive" && "font-medium text-destructive",
                vencimentoVariant === "warning" &&
                  "font-medium text-amber-600 dark:text-amber-400",
              )}
            >
              <CalendarIcon className="h-3 w-3" />
              {formatDate(subtarefa.data_inicio)}
            </span>
          )}
        </div>
      </button>
      {actions}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
});

export function SubtarefaAgendaCard({
  subtarefa,
  onOpen,
  /** Em breve: card menor que o de tarefa, mantendo as mesmas informações. */
  compact = false,
}: {
  subtarefa: SubtarefaAgendaItem;
  onOpen: () => void;
  compact?: boolean;
}) {
  const parentTitle = subtarefa.tarefa?.titulo?.trim() || "Tarefa principal";
  const badgeClass = compact ? "gap-0.5 px-1 py-0 text-[9px]" : "gap-1 px-1.5 py-0 text-[10px]";
  const iconClass = compact ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full border border-l-4 bg-card text-left shadow-sm transition-colors hover:bg-muted/40",
        compact ? "rounded-md px-2 py-1.5" : "rounded-lg px-3 py-2.5",
        TAREFA_PRIORIDADE_BAND_CLASS[subtarefa.prioridade],
      )}
    >
      <p
        className={cn(
          "line-clamp-2 font-medium leading-snug",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {subtarefa.titulo}
      </p>
      <DescricaoPreview
        descricao={subtarefa.descricao}
        className={cn(
          "leading-snug text-muted-foreground",
          compact
            ? "mt-0.5 line-clamp-1 text-[10px]"
            : "mt-1 line-clamp-2 text-[11px]",
        )}
      />
      <p
        className={cn(
          "truncate text-muted-foreground",
          compact ? "mt-0.5 text-[10px]" : "mt-1 text-[11px]",
        )}
      >
        de: {parentTitle}
      </p>
      <div className={cn("flex flex-wrap", compact ? "mt-1 gap-0.5" : "mt-1.5 gap-1")}>
        <Badge variant="secondary" className={badgeClass}>
          <ListTodo className={iconClass} />
          Subtarefa
        </Badge>
        <SubtarefaRecorrenciaBadge subtarefa={subtarefa} compact={compact} />
        {subtarefa.setor && (
          <Badge
            variant="outline"
            className={badgeClass}
            style={{
              borderColor: subtarefa.setor.cor ?? undefined,
              color: subtarefa.setor.cor ?? undefined,
            }}
          >
            {subtarefa.setor.nome}
          </Badge>
        )}
        {subtarefa.projeto && (
          <Badge variant="outline" className={badgeClass}>
            {subtarefa.projeto.nome}
          </Badge>
        )}
      </div>
    </button>
  );
}
