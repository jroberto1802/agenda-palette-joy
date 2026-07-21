import { CalendarIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { ConclusaoBolinha } from "@/components/tarefas/conclusao-bolinha";
import { DescricaoPreview } from "@/components/tarefas/descricao-preview";
import { MinhaAgendaBadge } from "@/components/tarefas/subtarefa-row";
import { TarefaActionsMenu } from "@/components/tarefas/tarefa-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TAREFA_CARD_FIXED_CLASS } from "@/lib/layout";
import type { TarefaWithRelations } from "@/types";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";
import {
  TAREFA_PRIORIDADE_BAND_CLASS,
  TAREFA_PRIORIDADE_COLORS,
  formatResponsaveisLabel,
  getTarefaResponsaveis,
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
  const podeAlternarConcluida = canToggleConcluida ?? canEdit;
  const vencimentoVariant = getVencimentoVariant(tarefa.data_inicio, tarefa.concluida);
  const responsaveis = getTarefaResponsaveis(tarefa);

  return (
    <Card
      className={cn(
        TAREFA_CARD_FIXED_CLASS,
        "flex flex-col border-l-4",
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
      <CardHeader className="shrink-0 space-y-0 p-3 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <ConclusaoBolinha
              concluida={tarefa.concluida}
              kind="tarefa"
              disabled={!podeAlternarConcluida}
              onToggle={onToggleConcluida}
              className="mt-0.5"
            />
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
        <div className="min-h-[2.25rem] shrink-0">
          <DescricaoPreview descricao={tarefa.descricao} />
        </div>

        <div className="flex h-4 min-w-0 shrink-0 items-center gap-3 overflow-hidden text-muted-foreground">
          {responsaveis.length > 0 ? (
            <span className="flex min-w-0 items-center gap-1">
              <div className="flex shrink-0 -space-x-1">
                {responsaveis.slice(0, 3).map((pessoa) => (
                  <ProfileAvatar
                    key={pessoa.id}
                    name={pessoa.nome_completo}
                    avatarUrl={pessoa.avatar_url}
                    className="h-4 w-4 ring-1 ring-background"
                  />
                ))}
              </div>
              <span className="truncate">{formatResponsaveisLabel(tarefa)}</span>
            </span>
          ) : (
            <span className="truncate text-transparent select-none" aria-hidden>
              —
            </span>
          )}
          {tarefa.data_inicio ? (
            <span
              className={cn(
                "ml-auto flex shrink-0 items-center gap-1",
                vencimentoVariant === "destructive" && "font-medium text-destructive",
                vencimentoVariant === "warning" &&
                  "font-medium text-amber-600 dark:text-amber-400",
              )}
            >
              <CalendarIcon className="h-3 w-3 shrink-0" />
              {formatDate(tarefa.data_inicio)}
            </span>
          ) : null}
        </div>

        <div className="flex h-4 min-w-0 shrink-0 items-center gap-1 overflow-hidden">
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
