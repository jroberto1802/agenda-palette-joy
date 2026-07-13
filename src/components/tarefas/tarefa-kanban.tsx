import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon, GripVertical, User } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TarefaStatus, TarefaWithRelations } from "@/types";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";
import {
  KANBAN_COLUMNS,
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_STATUS_COLORS,
  formatResponsaveisLabel,
} from "@/utils/tarefas";

function KanbanCardContent({
  tarefa,
  isDragging,
}: {
  tarefa: TarefaWithRelations;
  isDragging?: boolean;
}) {
  const vencimentoVariant = getVencimentoVariant(tarefa.data_vencimento, tarefa.status);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm space-y-2 cursor-pointer hover:border-primary/40 transition-colors",
        isDragging && "opacity-50 ring-2 ring-primary",
        tarefa.status === "concluida" && "opacity-75",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              tarefa.status === "concluida" && "line-through text-muted-foreground",
            )}
          >
            {tarefa.titulo}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            <Badge variant="outline" className={cn("text-xs", TAREFA_PRIORIDADE_COLORS[tarefa.prioridade])}>
              {tarefa.prioridade}
            </Badge>
            {tarefa.setor && (
              <Badge variant="outline" className="text-xs" style={{ borderColor: tarefa.setor.cor ?? undefined }}>
                {tarefa.setor.nome}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pl-6">
        {formatResponsaveisLabel(tarefa) !== "Sem responsável" && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {formatResponsaveisLabel(tarefa)}
          </span>
        )}
        {tarefa.data_vencimento && (
          <span
            className={cn(
              "flex items-center gap-1",
              vencimentoVariant === "destructive" && "text-destructive font-medium",
              vencimentoVariant === "warning" && "text-amber-600 dark:text-amber-400 font-medium",
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {formatDate(tarefa.data_vencimento)}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableKanbanCard({
  tarefa,
  onOpen,
}: {
  tarefa: TarefaWithRelations;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarefa.id,
    data: { status: tarefa.status },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onOpen}>
      <KanbanCardContent tarefa={tarefa} isDragging={isDragging} />
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  tarefas,
  onOpenTarefa,
}: {
  status: TarefaStatus;
  label: string;
  tarefas: TarefaWithRelations[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[280px] flex-1 max-w-sm">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={TAREFA_STATUS_COLORS[status]}>
            {label}
          </Badge>
          <span className="text-xs text-muted-foreground">{tarefas.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl border bg-muted/30 p-2 min-h-[420px] transition-colors",
          isOver && "border-primary bg-primary/5",
        )}
      >
        <ScrollArea className="h-[480px] pr-2">
          <div className="space-y-2">
            {tarefas.map((tarefa) => (
              <DraggableKanbanCard
                key={tarefa.id}
                tarefa={tarefa}
                onOpen={() => onOpenTarefa(tarefa)}
              />
            ))}
            {tarefas.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">Arraste tarefas aqui</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export function TarefaKanban({
  tarefas,
  onStatusChange,
  onOpenTarefa,
}: {
  tarefas: TarefaWithRelations[];
  onStatusChange: (tarefa: TarefaWithRelations, status: TarefaStatus) => void;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
}) {
  const [activeTarefa, setActiveTarefa] = useState<TarefaWithRelations | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byStatus = useMemo(() => {
    const map: Record<TarefaStatus, TarefaWithRelations[]> = {
      a_fazer: [],
      em_andamento: [],
      bloqueada: [],
      concluida: [],
    };
    for (const t of tarefas) {
      map[t.status].push(t);
    }
    return map;
  }, [tarefas]);

  const handleDragStart = (event: DragStartEvent) => {
    const tarefa = tarefas.find((t) => t.id === event.active.id);
    setActiveTarefa(tarefa ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTarefa(null);
    const { active, over } = event;
    if (!over) return;

    const tarefaId = String(active.id);
    const newStatus = over.id as TarefaStatus;
    const isColumn = KANBAN_COLUMNS.some((c) => c.id === newStatus);
    if (!isColumn) return;

    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (tarefa && tarefa.status !== newStatus) {
      onStatusChange(tarefa, newStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            label={col.label}
            tarefas={byStatus[col.id]}
            onOpenTarefa={onOpenTarefa}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTarefa ? <KanbanCardContent tarefa={activeTarefa} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
