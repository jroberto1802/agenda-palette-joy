import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TarefaCard } from "@/components/tarefas/tarefa-card";
import {
  useReorderTarefasLista,
  useSyncTarefaBoardItens,
  useTarefaBoardItens,
} from "@/hooks/use-tarefa-board";
import { DENSE_CARD_GRID_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { TarefaStatus, TarefaWithRelations } from "@/types";

function SortableCardShell({
  tarefa,
  canEdit,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tarefa: TarefaWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TarefaStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-70")}
    >
      <button
        type="button"
        className="absolute left-2 top-2 z-10 rounded-md bg-background/90 p-1 text-muted-foreground shadow-sm hover:bg-muted"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <TarefaCard
        tarefa={tarefa}
        canEdit={canEdit}
        canDelete={canDelete}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

export function TarefaCardsGrid({
  tarefas,
  canEdit,
  canDeleteTarefa,
  onOpenTarefa,
  onDelete,
  onStatusChange,
  enableReorder = false,
}: {
  tarefas: TarefaWithRelations[];
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
  onStatusChange: (tarefa: TarefaWithRelations, status: TarefaStatus) => void;
  enableReorder?: boolean;
}) {
  const { data: itens = [] } = useTarefaBoardItens(enableReorder);
  const syncItens = useSyncTarefaBoardItens();
  const reorderLista = useReorderTarefasLista();
  const [order, setOrder] = useState<string[]>([]);
  const tarefaIdsKey = useMemo(() => tarefas.map((t) => t.id).join(","), [tarefas]);

  useEffect(() => {
    if (!enableReorder || !tarefas.length) {
      setOrder(tarefas.map((t) => t.id));
      return;
    }
    void syncItens.mutateAsync(tarefas.map((t) => t.id)).catch(() => undefined);
  }, [enableReorder, tarefaIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enableReorder) {
      setOrder(tarefas.map((t) => t.id));
      return;
    }
    const pos = new Map(itens.map((i) => [i.tarefa_id, i.posicao_lista]));
    const sorted = [...tarefas].sort((a, b) => {
      const pa = pos.get(a.id);
      const pb = pos.get(b.id);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
    setOrder(sorted.map((t) => t.id));
  }, [enableReorder, itens, tarefaIdsKey, tarefas]);

  const byId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);
  const ordered = order.map((id) => byId.get(id)).filter((t): t is TarefaWithRelations => !!t);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    void reorderLista.mutateAsync(next).catch(() => undefined);
  };

  if (!enableReorder) {
    return (
      <div className={DENSE_CARD_GRID_CLASS}>
        {tarefas.map((tarefa) => (
          <TarefaCard
            key={tarefa.id}
            tarefa={tarefa}
            canEdit={canEdit(tarefa)}
            canDelete={canDeleteTarefa(tarefa)}
            onOpen={() => onOpenTarefa(tarefa)}
            onEdit={() => onOpenTarefa(tarefa)}
            onDelete={() => onDelete(tarefa)}
            onStatusChange={(status) => onStatusChange(tarefa, status)}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className={DENSE_CARD_GRID_CLASS}>
          {ordered.map((tarefa) => (
            <SortableCardShell
              key={tarefa.id}
              tarefa={tarefa}
              canEdit={canEdit(tarefa)}
              canDelete={canDeleteTarefa(tarefa)}
              onOpen={() => onOpenTarefa(tarefa)}
              onEdit={() => onOpenTarefa(tarefa)}
              onDelete={() => onDelete(tarefa)}
              onStatusChange={(status) => onStatusChange(tarefa, status)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
