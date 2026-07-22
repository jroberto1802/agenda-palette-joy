import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { AgendaAtrasadasActionsMenu } from "@/components/tarefas/agenda-atrasadas-actions";
import { ConfirmSerieDeleteDialog } from "@/components/tarefas/confirm-serie-delete-dialog";
import { SubtarefaAgendaListRow } from "@/components/tarefas/subtarefa-agenda-item";
import { TarefaListRowContent } from "@/components/tarefas/tarefa-list-view";
import {
  useDeleteSubtarefa,
  useSoftDeleteTarefaComEscopo,
  useToggleSubtarefa,
  useUpdateSubtarefaMeta,
  useUpdateTarefaConclusao,
  useUpdateTarefaDataInicio,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { EscopoExclusaoSerie } from "@/services/tarefa-recorrencia";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";
import { pertenceASerie } from "@/utils/recorrencia";

type AgendaAtrasadaItem =
  | { kind: "tarefa"; tarefa: TarefaWithRelations }
  | { kind: "subtarefa"; subtarefa: SubtarefaAgendaItem };

type DeletingItem =
  | { kind: "tarefa"; id: string; titulo: string; isSerie: boolean }
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
  const softDelete = useSoftDeleteTarefaComEscopo();
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

  const handleDeleteTarefa = async (escopo: EscopoExclusaoSerie) => {
    if (!deleting || deleting.kind !== "tarefa") return;
    try {
      await softDelete.mutateAsync({ id: deleting.id, escopo });
      toast.success("Tarefa excluída");
      setDeleting(null);
    } catch (error) {
      toast.error("Erro ao excluir tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const handleDeleteSubtarefa = async () => {
    if (!deleting || deleting.kind !== "subtarefa") return;
    try {
      await deleteSubtarefa.mutateAsync(deleting.id);
      toast.success("Subtarefa excluída");
      setDeleting(null);
    } catch (error) {
      toast.error("Erro ao excluir subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
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
                        isSerie: pertenceASerie(item.tarefa),
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

      <ConfirmSerieDeleteDialog
        open={deleting?.kind === "tarefa"}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        itemName={deleting?.kind === "tarefa" ? deleting.titulo : null}
        isSerie={deleting?.kind === "tarefa" ? deleting.isSerie : false}
        onConfirm={handleDeleteTarefa}
      />

      <ConfirmDeleteDialog
        open={deleting?.kind === "subtarefa"}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        itemKind="subtarefa"
        itemName={deleting?.kind === "subtarefa" ? deleting.titulo : null}
        onConfirm={handleDeleteSubtarefa}
      />
    </section>
  );
}
