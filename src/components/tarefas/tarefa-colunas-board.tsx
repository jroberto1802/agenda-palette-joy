import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { ConclusaoBolinha } from "@/components/tarefas/conclusao-bolinha";
import { MinhaAgendaBadge } from "@/components/tarefas/subtarefa-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCreateTarefaBoardColuna,
  useDeleteTarefaBoardColuna,
  useMoveTarefaEntreColunas,
  useRenameTarefaBoardColuna,
  useReorderTarefasNaColuna,
  useSyncTarefaBoardItens,
  useTarefaBoardColunas,
  useTarefaBoardItens,
} from "@/hooks/use-tarefa-board";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import type { TarefaBoardColuna } from "@/services/tarefa-board";
import type { TarefaWithRelations } from "@/types";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";
import {
  TAREFA_PRIORIDADE_BAND_CLASS,
  TAREFA_PRIORIDADE_COLORS,
  formatResponsaveisLabel,
} from "@/utils/tarefas";

function ColunaCardContent({
  tarefa,
  isDragging,
  onToggleConcluida,
  canToggleConcluida = true,
}: {
  tarefa: TarefaWithRelations;
  isDragging?: boolean;
  onToggleConcluida?: (concluida: boolean) => void | Promise<void>;
  canToggleConcluida?: boolean;
}) {
  const vencimentoVariant = getVencimentoVariant(tarefa.data_inicio, tarefa.concluida);

  return (
    <div
      className={cn(
        "space-y-2 cursor-pointer rounded-lg border border-l-4 bg-card p-3 shadow-sm transition-colors hover:border-primary/40",
        TAREFA_PRIORIDADE_BAND_CLASS[tarefa.prioridade],
        isDragging && "opacity-50 ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
        {onToggleConcluida && (
          <ConclusaoBolinha
            concluida={tarefa.concluida}
            kind="tarefa"
            disabled={!canToggleConcluida}
            onToggle={onToggleConcluida}
            className="mt-0.5"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{tarefa.titulo}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge
              variant="outline"
              className={cn("text-xs", TAREFA_PRIORIDADE_COLORS[tarefa.prioridade])}
            >
              {tarefa.prioridade}
            </Badge>
            {tarefa.setor && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: tarefa.setor.cor ?? undefined }}
              >
                {tarefa.setor.nome}
              </Badge>
            )}
            <MinhaAgendaBadge tarefa={tarefa} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
        {formatResponsaveisLabel(tarefa) !== "Sem responsável" && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {formatResponsaveisLabel(tarefa)}
          </span>
        )}
        {tarefa.data_inicio && (
          <span
            className={cn(
              "flex items-center gap-1",
              vencimentoVariant === "destructive" && "font-medium text-destructive",
              vencimentoVariant === "warning" &&
                "font-medium text-amber-600 dark:text-amber-400",
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {formatDate(tarefa.data_inicio)}
          </span>
        )}
      </div>
    </div>
  );
}

function SortableColunaCard({
  tarefa,
  onOpen,
  onToggleConcluida,
  canToggleConcluida,
}: {
  tarefa: TarefaWithRelations;
  onOpen: () => void;
  onToggleConcluida: (concluida: boolean) => void | Promise<void>;
  canToggleConcluida: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
    data: { type: "tarefa", tarefaId: tarefa.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      <ColunaCardContent
        tarefa={tarefa}
        isDragging={isDragging}
        onToggleConcluida={onToggleConcluida}
        canToggleConcluida={canToggleConcluida}
      />
    </div>
  );
}

function DroppableColuna({
  coluna,
  tarefas,
  onOpenTarefa,
  onToggleConcluida,
  canToggleConcluida,
  onRename,
  onDelete,
}: {
  coluna: TarefaBoardColuna;
  tarefas: TarefaWithRelations[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onToggleConcluida: (tarefa: TarefaWithRelations, concluida: boolean) => void | Promise<void>;
  canToggleConcluida: (tarefa: TarefaWithRelations) => boolean;
  onRename: (coluna: TarefaBoardColuna) => void;
  onDelete: (coluna: TarefaBoardColuna) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `coluna:${coluna.id}`,
    data: { type: "coluna", colunaId: coluna.id },
  });

  return (
    <div className="flex min-w-[280px] max-w-sm flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{coluna.nome}</p>
          <span className="text-xs text-muted-foreground">{tarefas.length}</span>
          {coluna.is_inbox && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              padrão
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(coluna)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Renomear
            </DropdownMenuItem>
            {!coluna.is_inbox && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(coluna)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Excluir coluna
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[420px] flex-1 rounded-xl border bg-muted/30 p-2 transition-colors",
          isOver && "border-primary bg-primary/5",
        )}
      >
        <ScrollArea className="h-[480px] pr-2">
          <SortableContext
            items={tarefas.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tarefas.map((tarefa) => (
                <SortableColunaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  onOpen={() => onOpenTarefa(tarefa)}
                  onToggleConcluida={(concluida) => onToggleConcluida(tarefa, concluida)}
                  canToggleConcluida={canToggleConcluida(tarefa)}
                />
              ))}
              {tarefas.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Arraste tarefas aqui
                </p>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

function findContainer(
  tarefaId: string,
  columnsState: Record<string, string[]>,
): string | null {
  for (const [colunaId, ids] of Object.entries(columnsState)) {
    if (ids.includes(tarefaId)) return colunaId;
  }
  return null;
}

export function TarefaColunasBoard({
  tarefas,
  onOpenTarefa,
  onToggleConcluida,
  canToggleConcluida,
}: {
  tarefas: TarefaWithRelations[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onToggleConcluida: (tarefa: TarefaWithRelations, concluida: boolean) => void | Promise<void>;
  canToggleConcluida: (tarefa: TarefaWithRelations) => boolean;
}) {
  const { data: colunas = [], isLoading: loadingColunas } = useTarefaBoardColunas();
  const { data: itens = [] } = useTarefaBoardItens();
  const syncItens = useSyncTarefaBoardItens();
  const createColuna = useCreateTarefaBoardColuna();
  const renameColuna = useRenameTarefaBoardColuna();
  const deleteColuna = useDeleteTarefaBoardColuna();
  const moveEntre = useMoveTarefaEntreColunas();
  const reorderNaColuna = useReorderTarefasNaColuna();

  const [columnsState, setColumnsState] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<TarefaBoardColuna | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<TarefaBoardColuna | null>(null);

  const tarefaById = useMemo(
    () => new Map(tarefas.map((t) => [t.id, t])),
    [tarefas],
  );

  const tarefaIdsKey = useMemo(() => tarefas.map((t) => t.id).sort().join(","), [tarefas]);

  useEffect(() => {
    if (!tarefas.length) return;
    void syncItens.mutateAsync(tarefas.map((t) => t.id)).catch(() => undefined);
  }, [tarefaIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!colunas.length) return;
    const itemByTarefa = new Map(itens.map((i) => [i.tarefa_id, i]));
    const next: Record<string, string[]> = {};
    for (const c of colunas) next[c.id] = [];

    const ordered = [...tarefas].sort((a, b) => {
      const ia = itemByTarefa.get(a.id);
      const ib = itemByTarefa.get(b.id);
      const ca = ia?.posicao_coluna ?? 0;
      const cb = ib?.posicao_coluna ?? 0;
      if (ca !== cb) return ca - cb;
      return a.titulo.localeCompare(b.titulo, "pt-BR");
    });

    const inbox = colunas.find((c) => c.is_inbox);
    for (const t of ordered) {
      const item = itemByTarefa.get(t.id);
      const colunaId = item?.coluna_id ?? inbox?.id;
      if (colunaId && next[colunaId]) next[colunaId].push(t.id);
      else if (inbox) next[inbox.id].push(t.id);
    }
    setColumnsState(next);
  }, [colunas, itens, tarefaIdsKey, tarefas]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeTarefa = activeId ? (tarefaById.get(activeId) ?? null) : null;

  const persistColumnOrder = async (
    colunaId: string,
    orderedIds: string[],
  ) => {
    try {
      await reorderNaColuna.mutateAsync({ colunaId, orderedTarefaIds: orderedIds });
    } catch (error) {
      toast.error("Erro ao reordenar", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeTarefaId = String(active.id);
    const overId = String(over.id);

    const activeContainer = findContainer(activeTarefaId, columnsState);
    let overContainer =
      over.data.current?.type === "coluna"
        ? String(over.data.current.colunaId)
        : findContainer(overId, columnsState);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumnsState((prev) => {
      const activeItems = [...(prev[activeContainer] ?? [])];
      const overItems = [...(prev[overContainer!] ?? [])];
      const activeIndex = activeItems.indexOf(activeTarefaId);
      if (activeIndex < 0) return prev;
      activeItems.splice(activeIndex, 1);

      const overIndex =
        over.data.current?.type === "coluna"
          ? overItems.length
          : overItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;
      overItems.splice(insertAt, 0, activeTarefaId);

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer!]: overItems,
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTarefaId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeTarefaId, columnsState);
    const overContainer =
      over.data.current?.type === "coluna"
        ? String(over.data.current.colunaId)
        : findContainer(overId, columnsState);

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const items = columnsState[activeContainer] ?? [];
      const oldIndex = items.indexOf(activeTarefaId);
      const newIndex =
        over.data.current?.type === "coluna"
          ? items.length - 1
          : items.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        await persistColumnOrder(activeContainer, items);
        return;
      }
      const next = arrayMove(items, oldIndex, newIndex);
      setColumnsState((prev) => ({ ...prev, [activeContainer]: next }));
      await persistColumnOrder(activeContainer, next);
      return;
    }

    const destIds = columnsState[overContainer] ?? [];
    try {
      await moveEntre.mutateAsync({
        tarefaId: activeTarefaId,
        colunaId: overContainer,
        posicaoColuna: destIds.indexOf(activeTarefaId),
        orderedTarefaIdsInColumn: destIds,
      });
      // Also reindex source column
      await persistColumnOrder(activeContainer, columnsState[activeContainer] ?? []);
    } catch (error) {
      toast.error("Erro ao mover tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleCreate = async () => {
    try {
      await createColuna.mutateAsync(newName);
      setCreateOpen(false);
      setNewName("");
      toast.success("Coluna criada");
    } catch (error) {
      toast.error("Erro ao criar coluna", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleRename = async () => {
    if (!renaming) return;
    try {
      await renameColuna.mutateAsync({ id: renaming.id, nome: renameValue });
      setRenaming(null);
      toast.success("Coluna renomeada");
    } catch (error) {
      toast.error("Erro ao renomear", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  if (loadingColunas) {
    return <p className="text-sm text-muted-foreground">Carregando colunas...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nova coluna
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((coluna) => (
            <DroppableColuna
              key={coluna.id}
              coluna={coluna}
              tarefas={(columnsState[coluna.id] ?? [])
                .map((id) => tarefaById.get(id))
                .filter((t): t is TarefaWithRelations => !!t)}
              onOpenTarefa={onOpenTarefa}
              onToggleConcluida={onToggleConcluida}
              canToggleConcluida={canToggleConcluida}
              onRename={(c) => {
                setRenaming(c);
                setRenameValue(c.nome);
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTarefa ? <ColunaCardContent tarefa={activeTarefa} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da coluna"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!newName.trim() || createColuna.isPending}
              onClick={() => void handleCreate()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear coluna</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!renameValue.trim() || renameColuna.isPending}
              onClick={() => void handleRename()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        itemKind="coluna"
        itemName={deleting?.nome}
        description={
          deleting
            ? `Excluir a coluna "${deleting.nome}"? As tarefas vão para "A organizar". A conclusão delas não muda.`
            : undefined
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteColuna.mutateAsync(deleting.id);
            toast.success("Coluna excluída");
            setDeleting(null);
          } catch (error) {
            toast.error("Erro ao excluir coluna", {
              description: getSupabaseErrorMessage(error as Error),
            });
            throw error;
          }
        }}
      />
    </div>
  );
}
