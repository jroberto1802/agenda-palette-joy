import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TarefaCalendarioView } from "@/components/tarefas/tarefa-calendario-view";
import { TarefaDetailSheet } from "@/components/tarefas/tarefa-detail-sheet";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Agenda" },
      { name: "description", content: "Visualize tarefas por data de vencimento." },
    ],
  }),
  component: CalendarioPage,
});

function CalendarioPage() {
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
        <p className="text-muted-foreground">
          Tarefas organizadas por data de vencimento com timeline diária.
        </p>
      </div>

      <TarefaCalendarioView onSelectTarefa={setDetailId} />

      <TarefaDetailSheet
        tarefaId={detailId}
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </div>
  );
}
