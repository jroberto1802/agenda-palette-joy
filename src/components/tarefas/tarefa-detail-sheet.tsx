import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";

export function TarefaDetailSheet({
  tarefaId,
  open,
  onOpenChange,
}: {
  tarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <TarefaPanelSheet
      tarefaId={tarefaId}
      open={open}
      onOpenChange={onOpenChange}
      readOnly
    />
  );
}
