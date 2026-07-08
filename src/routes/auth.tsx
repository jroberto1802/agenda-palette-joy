import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useChallengeMfa } from "@/hooks/use-mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getVerifiedTotpFactor, needsMfaChallenge } from "@/services/mfa";
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CoreGestor" },
      { name: "description", content: "Faça login ou crie sua conta para acessar o CoreGestor." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !session) return;
    needsMfaChallenge().then((required) => {
      if (!required) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [session, loading, navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CoreGestor</CardTitle>
          <CardDescription>Gerencie suas tarefas e as da equipe</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm onSubmit={signIn} />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm onSubmit={signUp} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function SignInForm({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const navigate = useNavigate();
  const challengeMfa = useChallengeMfa();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await onSubmit(email, password);
    setBusy(false);
    if (error) {
      toast.error("Falha ao entrar", { description: error });
      return;
    }

    const required = await needsMfaChallenge();
    if (required) {
      const factor = await getVerifiedTotpFactor();
      if (!factor) {
        toast.error("2FA configurado mas fator não encontrado");
        return;
      }
      setFactorId(factor.id);
      setMfaStep(true);
      return;
    }

    navigate({ to: "/dashboard" });
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || mfaCode.length < 6) return;
    try {
      await challengeMfa.mutateAsync({ factorId, code: mfaCode });
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("Código inválido", { description: "Verifique o código do autenticador." });
    }
  };

  if (mfaStep) {
    return (
      <form onSubmit={handleMfa} className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Digite o código de 6 dígitos do seu aplicativo autenticador.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Código 2FA</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            maxLength={6}
            required
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
            autoComplete="one-time-code"
          />
        </div>
        <Button type="submit" className="w-full" disabled={challengeMfa.isPending || mfaCode.length < 6}>
          {challengeMfa.isPending ? "Verificando..." : "Confirmar"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setMfaStep(false)}>
          Voltar
        </Button>
      </form>
    );
  }

  return (    <form onSubmit={handle} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Senha</Label>
        <Input
          id="signin-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await onSubmit(email, password);
    setBusy(false);
    if (error) {
      toast.error("Falha ao criar conta", { description: error });
    } else {
      toast.success("Conta criada!", {
        description: "Se a confirmação de email estiver ativa, verifique sua caixa de entrada.",
      });
    }
  };

  return (
    <form onSubmit={handle} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha (mín. 6 caracteres)</Label>
        <Input
          id="signup-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}
