import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { needsMfaChallenge } from "@/services/mfa";
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mfaChecked, setMfaChecked] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session) {
      setMfaChecked(false);
      return;
    }
    needsMfaChallenge()
      .then((required) => {
        setMfaRequired(required);
        setMfaChecked(true);
        if (required) navigate({ to: "/auth", replace: true });
      })
      .catch(() => setMfaChecked(true));
  }, [session, navigate]);

  if (loading || !session || !mfaChecked || mfaRequired) {    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
