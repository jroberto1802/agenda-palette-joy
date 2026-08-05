import { createFileRoute } from "@tanstack/react-router";
import { CadastroRecorrenciaPastasPanel } from "@/components/tarefas/cadastro-recorrencia-pastas-panel";
import { usePageHeader } from "@/contexts/page-header-context";

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
  usePageHeader({
    title: "Recorrentes",
    subtitle:
      "Crie pastas e gerencie modelos de série. A regra de recorrência só é criada e editada aqui.",
  });

  return (
    <div className="space-y-6">
      <CadastroRecorrenciaPastasPanel compactHeader />
    </div>
  );
}
