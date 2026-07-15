import { CalendarIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { ConclusaoBolinha } from "@/components/tarefas/conclusao-bolinha";
import { MinhaAgendaBadge } from "@/components/tarefas/subtarefa-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onDelete: () => void;
  onToggleConcluida: (concluida: boolean) => void | Promise<void>;
  onOpen?: () => void;
}) {
  const podeAlternarConcluida = canToggleConcluida ?? canEdit;
  const vencimentoVariant = getVencimentoVariant(tarefa.data_inicio, tarefa.concluida);

  return (
    <Card
      className={cn(
        "overflow-hidden border-l-4",
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
      <CardHeader className="space-y-0 p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <ConclusaoBolinha
              concluida={tarefa.concluida}
              kind="tarefa"
              disabled={!podeAlternarConcluida}
              onToggle={onToggleConcluida}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <Badge
                  variant="outline"
                  className={cn("px-1.5 py-0 text-[10px]", TAREFA_PRIORIDADE_COLORS[tarefa.prioridade])}
                >
                  {tarefa.prioridade}
                </Badge>
                {tarefa.setor && (
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0 text-[10px]"
                    style={{
                      borderColor: tarefa.setor.cor ?? undefined,
                      color: tarefa.setor.cor ?? undefined,
                    }}
                  >
                    {tarefa.setor.nome}
                  </Badge>
                )}
                <MinhaAgendaBadge tarefa={tarefa} className="px-1.5 py-0 text-[10px]" />
                {tarefa.projeto && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {tarefa.projeto.nome}
                  </Badge>
                )}
              </div>
              <CardTitle
                className={cn(
                  "text-sm font-semibold leading-snug",
                  tarefa.concluida && "line-through text-muted-foreground",
                )}
              >
                {tarefa.titulo}
              </CardTitle>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Ações da tarefa"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-3 pt-0 text-xs">
        {tarefa.descricao && (
          <p className="text-muted-foreground line-clamp-2 leading-snug">{tarefa.descricao}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          {getTarefaResponsaveis(tarefa).length > 0 && (
            <span className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {getTarefaResponsaveis(tarefa)
                  .slice(0, 3)
                  .map((pessoa) => (
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
          )}
          {tarefa.data_inicio && (
            <span
              className={cn(
                "flex items-center gap-1",
                vencimentoVariant === "destructive" && "text-destructive font-medium",
                vencimentoVariant === "warning" && "text-amber-600 dark:text-amber-400 font-medium",
              )}
            >
              <CalendarIcon className="h-3 w-3 shrink-0" />
              {formatDate(tarefa.data_inicio)}
            </span>
          )}
        </div>

        {tarefa.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tarefa.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
