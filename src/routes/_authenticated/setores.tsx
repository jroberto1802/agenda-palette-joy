import { createFileRoute, Navigate } from "@tanstack/react-router";
import { CadastroSetoresPanel } from "@/components/settings/cadastro-setores-panel";
import { useProfile } from "@/hooks/use-profile";
import { canManageSetores, isAdmin } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/setores")({
  component: SetoresPage,
});

function SetoresPage() {
  const { data: profile, isLoading } = useProfile();

  // Cadastro oficial fica em Configurações → Cadastros; redireciona admins.
  if (!isLoading && isAdmin(profile)) {
    return <Navigate to="/configuracoes" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setores</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize os setores da empresa. O gerenciamento completo fica em Configurações →
          Cadastros (Administrador).
        </p>
      </div>
      <CadastroSetoresPanel canManage={canManageSetores(profile)} />
    </div>
  );
}
