import { format, parseISO } from "date-fns";
import { CalendarIcon, Clock, ListTodo, MessageSquare, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TarefaWithRelations } from "@/types";
import { hasExplicitTime } from "@/utils/agenda-datas";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";

/** Ícones de subtarefas / comentários / anexos no card da tarefa. */
export function TarefaCardIndicadores({
  tarefa,
  className,
}: {
  tarefa: TarefaWithRelations;
  className?: string;
}) {
  const ind = tarefa.indicadores;
  const subtarefasTotal = ind?.subtarefas_total ?? 0;
  const subtarefasConcluidas = ind?.subtarefas_concluidas ?? 0;
  const comentarios = ind?.comentarios_count ?? 0;
  const anexos = ind?.anexos_count ?? 0;

  const showSubtarefas = subtarefasTotal > 0;
  const showComentarios = comentarios > 0;
  const showAnexos = anexos > 0;

  if (!showSubtarefas && !showComentarios && !showAnexos) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {showSubtarefas && (
        <span
          className="inline-flex items-center gap-0.5"
          title={`Subtarefas: ${subtarefasConcluidas} de ${subtarefasTotal}`}
        >
          <ListTodo className="h-3 w-3 shrink-0" aria-hidden />
          <span className="tabular-nums">
            {subtarefasConcluidas}/{subtarefasTotal}
          </span>
        </span>
      )}
      {showComentarios && (
        <span
          className="inline-flex text-foreground"
          title={`${comentarios} comentário${comentarios === 1 ? "" : "s"}`}
        >
          <MessageSquare className="h-3 w-3 shrink-0 fill-current" aria-hidden />
          <span className="sr-only">
            {comentarios} comentário{comentarios === 1 ? "" : "s"}
          </span>
        </span>
      )}
      {showAnexos && (
        <span
          className="inline-flex text-foreground"
          title={`${anexos} anexo${anexos === 1 ? "" : "s"}`}
        >
          <Paperclip className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="sr-only">
            {anexos} anexo{anexos === 1 ? "" : "s"}
          </span>
        </span>
      )}
    </div>
  );
}

/** Data no card; quando há hora explícita, mostra ícone de relógio + HH:mm. */
export function TarefaCardDataInicio({
  dataInicio,
  concluida,
  className,
  hideWhenModelo = false,
  isModelo = false,
}: {
  dataInicio: string | null | undefined;
  concluida?: boolean;
  className?: string;
  hideWhenModelo?: boolean;
  isModelo?: boolean;
}) {
  if (!dataInicio) return null;
  if (hideWhenModelo && isModelo) return null;

  const vencimentoVariant = getVencimentoVariant(dataInicio, concluida ?? false);
  const date = parseISO(dataInicio);
  const showHora = hasExplicitTime(date);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1",
        vencimentoVariant === "destructive" && "font-medium text-destructive",
        vencimentoVariant === "warning" &&
          "font-medium text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <CalendarIcon className="h-3 w-3 shrink-0" aria-hidden />
      <span>{formatDate(dataInicio)}</span>
      {showHora && (
        <span className="inline-flex items-center gap-0.5" title="Horário">
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          <span className="tabular-nums">{format(date, "HH:mm")}</span>
        </span>
      )}
    </span>
  );
}
