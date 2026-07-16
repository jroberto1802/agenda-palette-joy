import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DefinirSenhaObrigatoria } from "@/components/auth/definir-senha-obrigatoria";
import { AppShell } from "@/components/layouts/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { needsMfaChallenge } from "@/services/mfa";
import { hasSenhaTemporaria } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const checkedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      checkedUserId.current = null;
      setReady(false);
      navigate({ to: "/auth", replace: true });
      return;
    }

    const userId = session.user.id;
    if (checkedUserId.current === userId) return;

    let cancelled = false;
    setReady(false);

    needsMfaChallenge()
      .then((required) => {
        if (cancelled) return;
        checkedUserId.current = userId;
        if (required) {
          navigate({ to: "/auth", replace: true });
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          checkedUserId.current = userId;
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, loading, navigate]);

  if (loading || !session || !ready || loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Senha temporária: acesso apenas à definição da nova senha (prazo de 3 dias).
  if (profile && hasSenhaTemporaria(profile)) {
    return <DefinirSenhaObrigatoria profile={profile} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
