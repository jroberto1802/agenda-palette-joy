import { RefreshCw } from "lucide-react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { ConclusaoBolinha } from "@/components/tarefas/conclusao-bolinha";
import { DescricaoPreview } from "@/components/tarefas/descricao-preview";
import { SerieModeloBadge } from "@/components/tarefas/serie-modelo-badge";
import { MinhaAgendaBadge } from "@/components/tarefas/subtarefa-row";
import { TarefaActionsMenu } from "@/components/tarefas/tarefa-actions-menu";
import {
  TarefaCardDataInicio,
  TarefaCardIndicadores,
} from "@/components/tarefas/tarefa-card-indicadores";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TAREFA_CARD_FIXED_CLASS } from "@/lib/layout";
import type { TarefaWithRelations } from "@/types";
import { isSerieModelo } from "@/utils/recorrencia";
import {
  TAREFA_PRIORIDADE_BAND_CLASS,
  TAREFA_PRIORIDADE_COLORS,
  formatResponsaveisLabel,
  getTarefaPessoasCard,
} from "@/utils/tarefas";
import { cn } from "@/lib/utils";

export function TarefaCard({
  tarefa,
  canEdit,
  canDelete,
  canToggleConcluida,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onToggleConcluida,
  onOpen,
}: {
  tarefa: TarefaWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  /** Permissão específica da bolinha: concluir (aberta) ou reabrir (concluída, respeita janela de 20min). */
  canToggleConcluida?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  onToggleConcluida: (concluida: boolean) => void | Promise<void>;
  onOpen?: () => void;
}) {
  const podeAlternarConcluida =
    (canToggleConcluida ?? canEdit) && !isSerieModelo(tarefa);
  const pessoas = getTarefaPessoasCard(tarefa);
  const ehModelo = isSerieModelo(tarefa);

  return (
    <Card
      className={cn(
        TAREFA_CARD_FIXED_CLASS,
        "relative flex flex-col border-l-4",
        TAREFA_PRIORIDADE_BAND_CLASS[tarefa.prioridade],
        tarefa.concluida && "opacity-75",
        onOpen && "cursor-pointer transition-colors hover:bg-muted/40",
      )}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      {ehModelo && (
        <div
          className="pointer-events-none absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm"
          title="Série recorrente"
          aria-hidden
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2.5} />
        </div>
      )}

      <CardHeader className={cn("shrink-0 space-y-0 p-3 pb-1.5", ehModelo && "pt-8")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {!ehModelo && (
              <ConclusaoBolinha
                concluida={tarefa.concluida}
                kind="tarefa"
                disabled={!podeAlternarConcluida}
                onToggle={onToggleConcluida}
                className="mt-0.5"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 px-1.5 py-0 text-[10px]",
                    TAREFA_PRIORIDADE_COLORS[tarefa.prioridade],
                  )}
                >
                  {tarefa.prioridade}
                </Badge>
                {tarefa.setor && (
                  <Badge
                    variant="outline"
                    className="max-w-[6rem] shrink truncate px-1.5 py-0 text-[10px]"
                    style={{
                      borderColor: tarefa.setor.cor ?? undefined,
                      color: tarefa.setor.cor ?? undefined,
                    }}
                  >
                    {tarefa.setor.nome}
                  </Badge>
                )}
                <MinhaAgendaBadge tarefa={tarefa} className="shrink-0 px-1.5 py-0 text-[10px]" />
                {tarefa.projeto && (
                  <Badge
                    variant="outline"
                    className="max-w-[6rem] shrink truncate px-1.5 py-0 text-[10px]"
                  >
                    {tarefa.projeto.nome}
                  </Badge>
                )}
              </div>
              <CardTitle
                className={cn(
                  "line-clamp-2 text-sm font-semibold leading-snug",
                  tarefa.concluida && "line-through text-muted-foreground",
                )}
              >
                {tarefa.titulo}
              </CardTitle>
            </div>
          </div>

          <TarefaActionsMenu
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onMove={onMove}
            onDelete={onDelete}
          />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-3 pt-0 text-xs">
        <div className="min-h-0 shrink-0 overflow-hidden">
          {ehModelo ? (
            <SerieModeloBadge tarefa={tarefa} />
          ) : (
            <DescricaoPreview
              descricao={tarefa.descricao}
              className="line-clamp-1 text-xs leading-snug text-muted-foreground"
            />
          )}
        </div>

        <div className="mt-auto flex h-4 min-w-0 shrink-0 items-center gap-3 overflow-hidden text-muted-foreground">
          {pessoas.length > 0 ? (
            <span className="flex min-w-0 items-center gap-1">
              <TooltipProvider delayDuration={200}>
                <div className="flex shrink-0 -space-x-1">
                  {pessoas.slice(0, 3).map((pessoa) => (
                    <Tooltip key={pessoa.id}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <ProfileAvatar
                            name={pessoa.nome_completo}
                            avatarUrl={pessoa.avatar_url}
                            className="h-4 w-4 ring-1 ring-background"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{pessoa.nome_completo}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
              <span className="truncate">{formatResponsaveisLabel(tarefa)}</span>
            </span>
          ) : (
            <span className="truncate text-transparent select-none" aria-hidden>
              —
            </span>
          )}
          {!ehModelo && tarefa.data_inicio ? (
            <TarefaCardDataInicio
              dataInicio={tarefa.data_inicio}
              concluida={tarefa.concluida}
              className="ml-auto"
            />
          ) : null}
        </div>

        <div className="flex h-4 min-w-0 shrink-0 items-center gap-1.5 overflow-hidden">
          <TarefaCardIndicadores tarefa={tarefa} />
          {tarefa.tags.length > 0
            ? tarefa.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="max-w-[5rem] shrink truncate px-1.5 py-0 text-[10px]"
                >
                  {tag}
                </Badge>
              ))
            : null}
        </div>
      </CardContent>
    </Card>
  );
}
