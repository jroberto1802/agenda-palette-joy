import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { RecorrentesPastasBoard } from "@/components/tarefas/recorrentes-pastas-board";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { Button } from "@/components/ui/button";
import { useSeriesModelos } from "@/hooks/use-tarefas";

export const Route = createFileRoute("/_authenticated/recorrentes")({
  head: () => ({
    meta: [
      { title: "Recorrentes — CoreGestor" },
      {
        name: "description",
        content: "Gerencie séries recorrentes e pastas compartilháveis.",
      },
    ],
  }),
  component: RecorrentesPage,
});

function RecorrentesPage() {
  const { data: series, isLoading } = useSeriesModelos();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [creatingSerie, setCreatingSerie] = useState(false);

  const openSerie = (id: string) => {
    setPanelId(id);
    setCreatingSerie(false);
    setPanelOpen(true);
  };

  const openNovaSerie = () => {
    setPanelId(null);
    setCreatingSerie(true);
    setPanelOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recorrentes</h1>
          <p className="text-muted-foreground">
            Modelos de série e pastas. A regra de recorrência só é criada e editada aqui.
          </p>
        </div>
        <Button type="button" onClick={openNovaSerie} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova série
        </Button>
      </div>

      <RecorrentesPastasBoard
        series={series ?? []}
        isLoading={isLoading}
        onOpenSerie={openSerie}
      />

      <TarefaPanelSheet
        tarefaId={creatingSerie ? null : panelId}
        open={panelOpen}
        serieModeloMode
        onOpenChange={(next) => {
          setPanelOpen(next);
          if (!next) {
            setPanelId(null);
            setCreatingSerie(false);
          }
        }}
        onSaved={(id) => {
          setCreatingSerie(false);
          setPanelId(id);
          setPanelOpen(true);
        }}
      />
    </div>
  );
}
