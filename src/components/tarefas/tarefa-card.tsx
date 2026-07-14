import { CalendarIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TarefaStatus, TarefaWithRelations } from "@/types";
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export function TarefaCard({
  tarefa,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onStatusChange,
  onOpen,
}: {
  tarefa: TarefaWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TarefaStatus) => void;
  onOpen?: () => void;
}) {
  const vencimentoVariant = getVencimentoVariant(tarefa.data_vencimento, tarefa.status);

  return (
    <Card
      className={cn(
        tarefa.status === "concluida" && "opacity-75",
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
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[tarefa.prioridade]}>
                {tarefa.prioridade}
              </Badge>
              <Badge variant="secondary" className={TAREFA_STATUS_COLORS[tarefa.status]}>
                {TAREFA_STATUS_LABELS[tarefa.status]}
              </Badge>
              {tarefa.setor && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: tarefa.setor.cor ?? undefined,
                    color: tarefa.setor.cor ?? undefined,
                  }}
                >
                  {tarefa.setor.nome}
                </Badge>
              )}
              {tarefa.projeto && (
                <Badge variant="outline" className="text-xs">
                  {tarefa.projeto.nome}
                </Badge>
              )}
            </div>
            <CardTitle
              className={cn(
                "text-base leading-snug",
                tarefa.status === "concluida" && "line-through text-muted-foreground",
              )}
            >
              {tarefa.titulo}
            </CardTitle>
          </div>

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Ações da tarefa"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    {tarefa.status !== "em_andamento" && (
                      <DropdownMenuItem onClick={() => onStatusChange("em_andamento")}>
                        Iniciar
                      </DropdownMenuItem>
                    )}
                    {tarefa.status !== "concluida" && (
                      <DropdownMenuItem onClick={() => onStatusChange("concluida")}>
                        Concluir
                      </DropdownMenuItem>
                    )}
                    {tarefa.status !== "cancelada" && tarefa.status !== "concluida" && (
                      <DropdownMenuItem onClick={() => onStatusChange("cancelada")}>
                        Cancelar
                      </DropdownMenuItem>
                    )}
                    {tarefa.status !== "a_fazer" && tarefa.status !== "concluida" && (
                      <DropdownMenuItem onClick={() => onStatusChange("a_fazer")}>
                        Voltar para a fazer
                      </DropdownMenuItem>
                    )}
                  </>
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

      <CardContent className="space-y-3 text-sm">
        {tarefa.descricao && (
          <p className="text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {getTarefaResponsaveis(tarefa).length > 0 && (
            <span className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {getTarefaResponsaveis(tarefa)
                  .slice(0, 3)
                  .map((pessoa) => (
                    <ProfileAvatar
                      key={pessoa.id}
                      name={pessoa.nome_completo}
                      avatarUrl={pessoa.avatar_url}
                      className="h-5 w-5 ring-1 ring-background"
                    />
                  ))}
              </div>
              {formatResponsaveisLabel(tarefa)}
            </span>
          )}
          {tarefa.data_vencimento && (
            <span
              className={cn(
                "flex items-center gap-1.5",
                vencimentoVariant === "destructive" && "text-destructive font-medium",
                vencimentoVariant === "warning" && "text-amber-600 dark:text-amber-400 font-medium",
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatDate(tarefa.data_vencimento)}
            </span>
          )}
        </div>

        {tarefa.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tarefa.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
