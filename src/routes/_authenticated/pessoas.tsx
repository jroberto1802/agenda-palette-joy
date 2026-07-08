import { createFileRoute } from "@tanstack/react-router";
import { CadastroPessoasPanel } from "@/components/settings/cadastro-pessoas-panel";
import { useProfile } from "@/hooks/use-profile";
import { canManagePessoas } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/pessoas")({
  component: PessoasPage,
});

function PessoasPage() {
  const { data: profile } = useProfile();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize os colaboradores e mantenha os dados da equipe atualizados.
        </p>
      </div>
      <CadastroPessoasPanel canManage={canManagePessoas(profile)} />
    </div>
  );
}
