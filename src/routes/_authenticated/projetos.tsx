import { createFileRoute } from "@tanstack/react-router";
import { CadastroProjetosPanel } from "@/components/settings/cadastro-projetos-panel";
import { useProfile } from "@/hooks/use-profile";
import { canDeleteProjetos } from "@/utils/permissions";

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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie e gerencie projetos para agrupar tarefas relacionadas.
        </p>
      </div>
      <CadastroProjetosPanel
        canManage={!!profile}
        canDelete={canDeleteProjetos(profile)}
      />
    </div>
  );
}
