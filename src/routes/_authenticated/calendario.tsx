import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TarefaCalendarioView } from "@/components/tarefas/tarefa-calendario-view";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import type { SubtarefaAgendaItem } from "@/types";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — CoreGestor" },
      { name: "description", content: "Visualize tarefas por data." },
    ],
  }),
  component: CalendarioPage,
});

function CalendarioPage() {
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelSubtarefaId, setPanelSubtarefaId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const openTarefa = (id: string) => {
    setPanelId(id);
    setPanelSubtarefaId(null);
    setPanelOpen(true);
  };

  const openSubtarefa = (subtarefa: SubtarefaAgendaItem) => {
    setPanelId(subtarefa.tarefa_id);
    setPanelSubtarefaId(subtarefa.id);
    setPanelOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
        <p className="text-muted-foreground">
          Tarefas organizadas por data com timeline diária.
        </p>
      </div>

      <TarefaCalendarioView
        onSelectTarefa={openTarefa}
        onSelectSubtarefa={openSubtarefa}
      />

      <TarefaPanelSheet
        tarefaId={panelId}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) {
            setPanelId(null);
            setPanelSubtarefaId(null);
          }
        }}
        initialSubtarefaId={panelSubtarefaId}
      />
    </div>
  );
}
