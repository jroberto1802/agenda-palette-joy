import { useMemo } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SubtarefaAgendaListRow } from "@/components/tarefas/subtarefa-agenda-item";
import { TarefaListRowContent } from "@/components/tarefas/tarefa-list-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSubtarefasAgenda,
  useTarefas,
  useToggleSubtarefa,
  useUpdateTarefaConclusao,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";
import { startOfTodayLocal, toLocalDateKey } from "@/utils/agenda-datas";

type AgendaHojeItem =
  | { kind: "tarefa"; tarefa: TarefaWithRelations }
  | { kind: "subtarefa"; subtarefa: SubtarefaAgendaItem };

export function AgendaHojeView({
  usuarioId,
  onOpenTarefa,
  onOpenSubtarefa,
  onCreate,
}: {
  usuarioId: string | undefined;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onOpenSubtarefa: (subtarefa: SubtarefaAgendaItem) => void;
  onCreate: () => void;
}) {
  const hojeKey = toLocalDateKey(startOfTodayLocal())!;
  const updateConclusao = useUpdateTarefaConclusao();
  const toggleSubtarefaMut = useToggleSubtarefa();

  const handleToggleConcluida = async (tarefa: TarefaWithRelations, concluida: boolean) => {
    try {
      await updateConclusao.mutateAsync({ id: tarefa.id, concluida });
      toast.success(concluida ? "Tarefa concluída" : "Tarefa reaberta");
    } catch (error) {
      toast.error(concluida ? "Erro ao concluir tarefa" : "Erro ao reabrir tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const handleToggleSubtarefa = async (subtarefa: SubtarefaAgendaItem, concluida: boolean) => {
    try {
      await toggleSubtarefaMut.mutateAsync({ id: subtarefa.id, concluida });
      toast.success(concluida ? "Subtarefa concluída" : "Subtarefa reaberta");
    } catch (error) {
      toast.error(concluida ? "Erro ao concluir subtarefa" : "Erro ao reabrir subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const { data: tarefas, isLoading: loadingTarefas } = useTarefas(
    {
      excluir_finalizadas: true,
      atribuido_ids: usuarioId ? [usuarioId] : [],
      data_inicio_de: hojeKey,
      data_inicio_ate: hojeKey,
    },
    { enabled: !!usuarioId },
  );

  const { data: subtarefas, isLoading: loadingSubtarefas } = useSubtarefasAgenda(
    {
      usuario_id: usuarioId ?? "",
      data_inicio_de: hojeKey,
      data_inicio_ate: hojeKey,
    },
    { enabled: !!usuarioId },
  );

  const items = useMemo((): AgendaHojeItem[] => {
    const tarefasDoDia = (tarefas ?? []).filter(
      (t) => toLocalDateKey(t.data_inicio) === hojeKey,
    );
    const subtarefasDoDia = (subtarefas ?? []).filter(
      (s) => toLocalDateKey(s.data_inicio) === hojeKey,
    );

    return [
      ...tarefasDoDia.map((tarefa) => ({ kind: "tarefa" as const, tarefa })),
      ...subtarefasDoDia.map((subtarefa) => ({ kind: "subtarefa" as const, subtarefa })),
    ].sort((a, b) => {
      const titleA = a.kind === "tarefa" ? a.tarefa.titulo : a.subtarefa.titulo;
      const titleB = b.kind === "tarefa" ? b.tarefa.titulo : b.subtarefa.titulo;
      return titleA.localeCompare(titleB, "pt-BR");
    });
  }, [tarefas, subtarefas, hojeKey]);

  const isLoading = loadingTarefas || loadingSubtarefas;

  if (!usuarioId || isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">Nenhuma tarefa ou subtarefa com Data para hoje.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Adicionar tarefa
        </Button>
      </div>
    );
  }

  return (
    <div className="max-h-[min(70vh,720px)] space-y-2 overflow-y-auto pr-1">
      <ul className="space-y-2">
        {items.map((item) =>
          item.kind === "tarefa" ? (
            <li key={`tarefa-${item.tarefa.id}`}>
              <TarefaListRowContent
                tarefa={item.tarefa}
                onOpen={() => onOpenTarefa(item.tarefa)}
                onToggleConcluida={(concluida) => handleToggleConcluida(item.tarefa, concluida)}
              />
            </li>
          ) : (
            <li key={`subtarefa-${item.subtarefa.id}`}>
              <SubtarefaAgendaListRow
                subtarefa={item.subtarefa}
                onOpen={() => onOpenSubtarefa(item.subtarefa)}
                onToggleConcluida={(concluida) => handleToggleSubtarefa(item.subtarefa, concluida)}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
