import { createFileRoute } from "@tanstack/react-router";
import { CadastroProjetosPanel } from "@/components/settings/cadastro-projetos-panel";
import { useProfile } from "@/hooks/use-profile";
import { canCreateProjetos } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos — CoreGestor" },
      { name: "description", content: "Gestão de projetos e agrupamento de tarefas." },
    ],
  }),
  component: ProjetosPage,
});

function ProjetosPage() {
  const { data: profile } = useProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie e gerencie projetos para agrupar tarefas relacionadas.
        </p>
      </div>
      <CadastroProjetosPanel
        canManage={canCreateProjetos(profile)}
        compactHeader
      />
    </div>
  );
}
