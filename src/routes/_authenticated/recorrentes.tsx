import { createFileRoute } from "@tanstack/react-router";
import { CadastroRecorrenciaPastasPanel } from "@/components/tarefas/cadastro-recorrencia-pastas-panel";

export const Route = createFileRoute("/_authenticated/recorrentes")({
  head: () => ({
    meta: [
      { title: "Recorrentes — CoreGestor" },
      {
        name: "description",
        content: "Organize séries recorrentes em pastas, no mesmo padrão de Projetos.",
      },
    ],
  }),
  component: RecorrentesPage,
});

function RecorrentesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recorrentes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie pastas e gerencie modelos de série. A regra de recorrência só é criada e editada
          aqui.
        </p>
      </div>
      <CadastroRecorrenciaPastasPanel compactHeader />
    </div>
  );
}
