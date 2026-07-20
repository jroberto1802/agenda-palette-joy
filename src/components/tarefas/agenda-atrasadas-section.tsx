import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { AgendaAtrasadasActionsMenu } from "@/components/tarefas/agenda-atrasadas-actions";
import { SubtarefaAgendaListRow } from "@/components/tarefas/subtarefa-agenda-item";
import { TarefaListRowContent } from "@/components/tarefas/tarefa-list-view";
import {
  useDeleteSubtarefa,
  useSoftDeleteTarefa,
  useToggleSubtarefa,
  useUpdateSubtarefaMeta,
  useUpdateTarefaConclusao,
  useUpdateTarefaDataInicio,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";

type AgendaAtrasadaItem =
  | { kind: "tarefa"; tarefa: TarefaWithRelations }
  | { kind: "subtarefa"; subtarefa: SubtarefaAgendaItem };

type DeletingItem =
  | { kind: "tarefa"; id: string; titulo: string }
  | { kind: "subtarefa"; id: string; titulo: string };

export function AgendaAtrasadasSection({
  items,
  onOpenTarefa,
  onOpenSubtarefa,
}: {
  items: AgendaAtrasadaItem[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onOpenSubtarefa: (subtarefa: SubtarefaAgendaItem) => void;
}) {
  const updateConclusao = useUpdateTarefaConclusao();
  const updateDataInicio = useUpdateTarefaDataInicio();
  const softDelete = useSoftDeleteTarefa();
  const toggleSubtarefaMut = useToggleSubtarefa();
  const updateSubtarefaMeta = useUpdateSubtarefaMeta();
  const deleteSubtarefa = useDeleteSubtarefa();

  const [deleting, setDeleting] = useState<DeletingItem | null>(null);

  if (!items.length) return null;

  const handleConcluirTarefa = async (tarefa: TarefaWithRelations) => {
    try {
      await updateConclusao.mutateAsync({ id: tarefa.id, concluida: true });
      toast.success("Tarefa concluída");
    } catch (error) {
      toast.error("Erro ao concluir tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const handleConcluirSubtarefa = async (subtarefa: SubtarefaAgendaItem) => {
    try {
      await toggleSubtarefaMut.mutateAsync({ id: subtarefa.id, concluida: true });
      toast.success("Subtarefa concluída");
    } catch (error) {
      toast.error("Erro ao concluir subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const handleReagendarTarefa = async (tarefa: TarefaWithRelations, dataInicio: string) => {
    try {
      await updateDataInicio.mutateAsync({ id: tarefa.id, dataInicio });
      toast.success("Tarefa reagendada");
    } catch (error) {
      toast.error("Erro ao reagendar tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleReagendarSubtarefa = async (
    subtarefa: SubtarefaAgendaItem,
    dataInicio: string,
  ) => {
    try {
      await updateSubtarefaMeta.mutateAsync({
        id: subtarefa.id,
        data: { data_inicio: dataInicio },
      });
      toast.success("Subtarefa reagendada");
    } catch (error) {
      toast.error("Erro ao reagendar subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleManter = () => {
    toast.message("Item permanece atrasado");
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      if (deleting.kind === "tarefa") {
        await softDelete.mutateAsync(deleting.id);
        toast.success("Tarefa excluída");
      } else {
        await deleteSubtarefa.mutateAsync(deleting.id);
        toast.success("Subtarefa excluída");
      }
      setDeleting(null);
    } catch (error) {
      toast.error(
        deleting.kind === "tarefa" ? "Erro ao excluir tarefa" : "Erro ao excluir subtarefa",
        { description: getSupabaseErrorMessage(error as Error) },
      );
      throw error;
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold text-destructive">Atrasadas</h3>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <ul className="space-y-2">
        {items.map((item) =>
          item.kind === "tarefa" ? (
            <li key={`atrasada-tarefa-${item.tarefa.id}`}>
              <TarefaListRowContent
                tarefa={item.tarefa}
                showAtrasadaBadge
                onOpen={() => onOpenTarefa(item.tarefa)}
                onToggleConcluida={() => handleConcluirTarefa(item.tarefa)}
                actions={
                  <AgendaAtrasadasActionsMenu
                    label="Ações da tarefa atrasada"
                    onConcluir={() => void handleConcluirTarefa(item.tarefa).catch(() => undefined)}
                    onReagendar={(dataInicio) =>
                      void handleReagendarTarefa(item.tarefa, dataInicio)
                    }
                    onManter={handleManter}
                    onExcluir={() =>
                      setDeleting({
                        kind: "tarefa",
                        id: item.tarefa.id,
                        titulo: item.tarefa.titulo,
                      })
                    }
                  />
                }
              />
            </li>
          ) : (
            <li key={`atrasada-subtarefa-${item.subtarefa.id}`}>
              <SubtarefaAgendaListRow
                subtarefa={item.subtarefa}
                showAtrasadaBadge
                onOpen={() => onOpenSubtarefa(item.subtarefa)}
                onToggleConcluida={() => handleConcluirSubtarefa(item.subtarefa)}
                actions={
                  <AgendaAtrasadasActionsMenu
                    label="Ações da subtarefa atrasada"
                    onConcluir={() =>
                      void handleConcluirSubtarefa(item.subtarefa).catch(() => undefined)
                    }
                    onReagendar={(dataInicio) =>
                      void handleReagendarSubtarefa(item.subtarefa, dataInicio)
                    }
                    onManter={handleManter}
                    onExcluir={() =>
                      setDeleting({
                        kind: "subtarefa",
                        id: item.subtarefa.id,
                        titulo: item.subtarefa.titulo,
                      })
                    }
                  />
                }
              />
            </li>
          ),
        )}
      </ul>

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        itemKind={deleting?.kind === "subtarefa" ? "subtarefa" : "tarefa"}
        itemName={deleting?.titulo}
        onConfirm={handleDelete}
      />
    </section>
  );
}
