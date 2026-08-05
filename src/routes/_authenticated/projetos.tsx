import { createFileRoute } from "@tanstack/react-router";
import { CadastroProjetosPanel } from "@/components/settings/cadastro-projetos-panel";
import { usePageHeader } from "@/contexts/page-header-context";
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

  usePageHeader({
    title: "Projetos",
    subtitle: "Crie e gerencie projetos para agrupar tarefas relacionadas.",
  });

  return (
    <div className="space-y-6">
      <CadastroProjetosPanel
        canManage={canCreateProjetos(profile)}
        compactHeader
      />
    </div>
  );
}
