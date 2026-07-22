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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  CalendarIcon,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { ConclusaoBolinha } from "@/components/tarefas/conclusao-bolinha";
import { DescricaoPreview } from "@/components/tarefas/descricao-preview";
import { SerieModeloBadge } from "@/components/tarefas/serie-modelo-badge";
import { MinhaAgendaBadge } from "@/components/tarefas/subtarefa-row";
import { TarefaActionsMenu } from "@/components/tarefas/tarefa-actions-menu";
import { Badge } from "@/components/ui/badge";
import { useReorderTarefasLista, useSyncTarefaBoardItens, useTarefaBoardItens } from "@/hooks/use-tarefa-board";
import { cn } from "@/lib/utils";
import type { TarefaWithRelations } from "@/types";
import { formatDate, getVencimentoVariant } from "@/utils/formatters";
import { isSerieModelo } from "@/utils/recorrencia";
import {
  TAREFA_PRIORIDADE_BAND_CLASS,
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_PRIORIDADE_LABELS,
  formatResponsaveisLabel,
  getTarefaResponsaveis,
} from "@/utils/tarefas";

export function TarefaListRowContent({
  tarefa,
  onOpen,
  onToggleConcluida,
  canToggleConcluida = true,
  actions,
  dragHandle,
  isDragging,
  showAtrasadaBadge = false,
}: {
  tarefa: TarefaWithRelations;
  onOpen: () => void;
  onToggleConcluida?: (concluida: boolean) => void | Promise<void>;
  canToggleConcluida?: boolean;
  actions?: ReactNode;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  showAtrasadaBadge?: boolean;
}) {
  const vencimentoVariant = getVencimentoVariant(tarefa.data_inicio, tarefa.concluida);
  const ehModelo = isSerieModelo(tarefa);

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-l-4 bg-card px-2 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 sm:gap-3 sm:px-4",
        TAREFA_PRIORIDADE_BAND_CLASS[tarefa.prioridade],
        isDragging && "opacity-60 ring-2 ring-primary",
      )}
    >
      {dragHandle}
      {onToggleConcluida && !ehModelo && (
        <ConclusaoBolinha
          concluida={tarefa.concluida}
          kind="tarefa"
          disabled={!canToggleConcluida}
          onToggle={onToggleConcluida}
        />
      )}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-1 text-left">
        <p
          className={cn(
            "truncate text-sm font-medium",
            tarefa.concluida && "text-muted-foreground line-through",
          )}
        >
          {tarefa.titulo}
        </p>
        <DescricaoPreview descricao={tarefa.descricao} />
        {ehModelo && <SerieModeloBadge tarefa={tarefa} />}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {showAtrasadaBadge && (
            <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              Atrasada
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn("px-1.5 py-0 text-[10px]", TAREFA_PRIORIDADE_COLORS[tarefa.prioridade])}
          >
            {TAREFA_PRIORIDADE_LABELS[tarefa.prioridade]}
          </Badge>
          <MinhaAgendaBadge tarefa={tarefa} className="px-1.5 py-0 text-[10px]" />
          {getTarefaResponsaveis(tarefa).length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ProfileAvatar
                name={getTarefaResponsaveis(tarefa)[0]?.nome_completo ?? "?"}
                avatarUrl={getTarefaResponsaveis(tarefa)[0]?.avatar_url}
                className="h-4 w-4"
              />
              <span className="truncate">{formatResponsaveisLabel(tarefa)}</span>
            </span>
          )}
          {tarefa.data_inicio && !ehModelo && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
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
      </button>
      {actions}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function SortableListRow({
  tarefa,
  onOpen,
  onToggleConcluida,
  canToggleConcluida,
  actions,
}: {
  tarefa: TarefaWithRelations;
  onOpen: () => void;
  onToggleConcluida?: (concluida: boolean) => void | Promise<void>;
  canToggleConcluida?: boolean;
  actions?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
  });

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <TarefaListRowContent
        tarefa={tarefa}
        onOpen={onOpen}
        onToggleConcluida={onToggleConcluida}
        canToggleConcluida={canToggleConcluida}
        actions={actions}
        isDragging={isDragging}
        dragHandle={
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </li>
  );
}

export function TarefaListView({
  tarefas,
  onOpenTarefa,
  onToggleConcluida,
  canToggleConcluida,
  canEdit,
  canDeleteTarefa,
  onDuplicate,
  onMove,
  onDelete,
  enableReorder = false,
}: {
  tarefas: TarefaWithRelations[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onToggleConcluida?: (tarefa: TarefaWithRelations, concluida: boolean) => void | Promise<void>;
  canToggleConcluida?: (tarefa: TarefaWithRelations) => boolean;
  canEdit?: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa?: (tarefa: TarefaWithRelations) => boolean;
  onDuplicate?: (tarefa: TarefaWithRelations) => void;
  onMove?: (tarefa: TarefaWithRelations) => void;
  onDelete?: (tarefa: TarefaWithRelations) => void;
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

  const renderActions = (tarefa: TarefaWithRelations) => {
    if (!canEdit || !onDuplicate || !onMove || !onDelete) return undefined;
    return (
      <TarefaActionsMenu
        canEdit={canEdit(tarefa)}
        canDelete={canDeleteTarefa ? canDeleteTarefa(tarefa) : false}
        onEdit={() => onOpenTarefa(tarefa)}
        onDuplicate={() => onDuplicate(tarefa)}
        onMove={() => onMove(tarefa)}
        onDelete={() => onDelete(tarefa)}
      />
    );
  };

  if (!enableReorder) {
    return (
      <div className="max-h-[min(70vh,720px)] space-y-2 overflow-y-auto pr-1">
        <ul className="space-y-2">
          {tarefas.map((tarefa) => (
            <li key={tarefa.id}>
              <TarefaListRowContent
                tarefa={tarefa}
                onOpen={() => onOpenTarefa(tarefa)}
                onToggleConcluida={
                  onToggleConcluida
                    ? (concluida) => onToggleConcluida(tarefa, concluida)
                    : undefined
                }
                canToggleConcluida={canToggleConcluida ? canToggleConcluida(tarefa) : undefined}
                actions={renderActions(tarefa)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="max-h-[min(70vh,720px)] space-y-2 overflow-y-auto pr-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {ordered.map((tarefa) => (
              <SortableListRow
                key={tarefa.id}
                tarefa={tarefa}
                onOpen={() => onOpenTarefa(tarefa)}
                onToggleConcluida={
                  onToggleConcluida
                    ? (concluida) => onToggleConcluida(tarefa, concluida)
                    : undefined
                }
                canToggleConcluida={canToggleConcluida ? canToggleConcluida(tarefa) : undefined}
                actions={renderActions(tarefa)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
