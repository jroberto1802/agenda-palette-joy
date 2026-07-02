import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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

  if (loading || !session || !ready) {
    return (
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
