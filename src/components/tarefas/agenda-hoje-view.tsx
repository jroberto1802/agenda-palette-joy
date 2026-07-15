import { useMemo } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { TarefaListView } from "@/components/tarefas/tarefa-list-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTarefas, useUpdateTarefaConclusao } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { TarefaWithRelations } from "@/types";
import { startOfTodayLocal, toLocalDateKey } from "@/utils/agenda-datas";

export function AgendaHojeView({
  usuarioId,
  onOpenTarefa,
  onCreate,
}: {
  usuarioId: string | undefined;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onCreate: () => void;
}) {
  const hojeKey = toLocalDateKey(startOfTodayLocal())!;
  const updateConclusao = useUpdateTarefaConclusao();

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

  const { data: tarefas, isLoading } = useTarefas(
    {
      excluir_finalizadas: true,
      atribuido_ids: usuarioId ? [usuarioId] : [],
      data_inicio_de: hojeKey,
      data_inicio_ate: hojeKey,
    },
    { enabled: !!usuarioId },
  );

  const doDia = useMemo(() => {
    return (tarefas ?? []).filter((t) => toLocalDateKey(t.data_inicio) === hojeKey);
  }, [tarefas, hojeKey]);

  if (!usuarioId || isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!doDia.length) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">Nenhuma tarefa com Data para hoje.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Adicionar tarefa
        </Button>
      </div>
    );
  }

  return (
    <TarefaListView
      tarefas={doDia}
      onOpenTarefa={onOpenTarefa}
      onToggleConcluida={handleToggleConcluida}
    />
  );
}
