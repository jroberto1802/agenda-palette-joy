import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useChallengeMfa } from "@/hooks/use-mfa";
import { useEmpresaConfig } from "@/hooks/use-empresa";
import { EMPRESA_NOME_PADRAO } from "@/services/empresa";
import { getVerifiedTotpFactor, needsMfaChallenge } from "@/services/mfa";
import { cn } from "@/lib/utils";
import logoUnida from "@/assets/logo-unida.png";

const REMEMBER_EMAIL_KEY = "coregestor-remember-email";
const REMEMBER_FLAG_KEY = "coregestor-remember-me";

type AuthView = "signin" | "forgot" | "reset";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CoreGestor" },
      { name: "description", content: "Acesse sua conta no CoreGestor." },
    ],
  }),
  component: AuthPage,
});

function readRememberedEmail(): { email: string; remember: boolean } {
  try {
    const remember = localStorage.getItem(REMEMBER_FLAG_KEY) === "1";
    const email = remember ? (localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "") : "";
    return { email, remember };
  } catch {
    return { email: "", remember: false };
  }
}

function persistRememberEmail(email: string, remember: boolean) {
  try {
    if (remember && email.trim()) {
      localStorage.setItem(REMEMBER_FLAG_KEY, "1");
      localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    } else {
      localStorage.removeItem(REMEMBER_FLAG_KEY);
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function AuthPage() {
  const { session, loading, passwordRecovery, signIn, requestPasswordReset, updatePassword } =
    useAuth();
  const navigate = useNavigate();
  const { data: empresa } = useEmpresaConfig();
  const [view, setView] = useState<AuthView>("signin");

  const empresaNome = empresa?.nome?.trim() || EMPRESA_NOME_PADRAO;

  useEffect(() => {
    if (passwordRecovery) setView("reset");
  }, [passwordRecovery]);

  useEffect(() => {
    if (loading || !session) return;
    if (passwordRecovery || view === "reset") return;

    needsMfaChallenge().then((required) => {
      if (!required) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [session, loading, navigate, passwordRecovery, view]);

  return (
    <div className="relative flex min-h-screen">
      {/* Painel de marca — desktop */}
      <aside className="relative hidden w-[46%] overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:w-[48%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 20%, rgba(30,64,175,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(71,85,105,0.45), transparent 50%), linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #1e3a5f 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src={logoUnida}
            alt=""
            className="h-[4.5rem] w-[4.5rem] shrink-0 object-contain mix-blend-screen xl:h-20 xl:w-20"
          />
          <div className="min-w-0">
            <p className="text-base font-medium leading-tight text-white">
              {empresaNome}
            </p>
            <p className="mt-0.5 text-sm text-slate-300">CoreGestor</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-white xl:text-5xl">
            Agenda corporativa com clareza e controle.
          </h1>
          <p className="text-base leading-relaxed text-slate-300">
            Acesse tarefas, projetos e equipe em um só lugar — com segurança e
            organização para o dia a dia.
          </p>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} {empresaNome}
        </p>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-1 flex-col justify-center bg-background px-6 py-12 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              "radial-gradient(ellipse 100% 40% at 50% 0%, rgba(30,64,175,0.08), transparent 60%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              <img
                src={logoUnida}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">{empresaNome}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">CoreGestor</p>
            </div>
          </div>

          {view === "signin" && (
            <SignInForm
              onSubmit={signIn}
              onForgot={() => setView("forgot")}
            />
          )}
          {view === "forgot" && (
            <ForgotPasswordForm
              onSubmit={requestPasswordReset}
              onBack={() => setView("signin")}
            />
          )}
          {view === "reset" && (
            <ResetPasswordForm
              onSubmit={updatePassword}
              onDone={() => {
                setView("signin");
                navigate({ to: "/dashboard", replace: true });
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function SignInForm({
  onSubmit,
  onForgot,
}: {
  onSubmit: (email: string, password: string) => Promise<{ error: string | null }>;
  onForgot: () => void;
}) {
  const remembered = readRememberedEmail();
  const [email, setEmail] = useState(remembered.email);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(remembered.remember);
  const [showPassword, setShowPassword] = useState(false);
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

    persistRememberEmail(email, rememberMe);

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
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Verificação em duas etapas</h2>
          <p className="text-sm text-muted-foreground">
            Digite o código de 6 dígitos do seu aplicativo autenticador.
          </p>
        </div>
        <form onSubmit={handleMfa} className="space-y-4">
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
              className="h-11 tracking-[0.3em]"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={challengeMfa.isPending || mfaCode.length < 6}
          >
            {challengeMfa.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMfaStep(false)}
          >
            Voltar
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
        <p className="text-sm text-muted-foreground">
          Use suas credenciais corporativas para acessar o sistema.
        </p>
      </div>

      <form onSubmit={handle} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-11 pl-10"
              placeholder="seu.email@empresa.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="signin-password">Senha</Label>
            <button
              type="button"
              onClick={onForgot}
              className="text-xs font-medium text-primary hover:underline"
            >
              Esqueceu a senha?
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 pl-10 pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal">
            Lembrar-me
          </Label>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </div>
  );
}

function ForgotPasswordForm({
  onSubmit,
  onBack,
}: {
  onSubmit: (email: string) => Promise<{ error: string | null }>;
  onBack: () => void;
}) {
  const remembered = readRememberedEmail();
  const [email, setEmail] = useState(remembered.email);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await onSubmit(email);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail", { description: error });
      return;
    }
    setSent(true);
    toast.success("E-mail enviado", {
      description: "Se o e-mail existir, você receberá o link para redefinir a senha.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Redefinir senha</h2>
        <p className="text-sm text-muted-foreground">
          Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.
        </p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Verifique a caixa de entrada de <span className="font-medium text-foreground">{email}</span>{" "}
            e também o spam. O link expira por segurança.
          </div>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onBack}>
            Voltar ao login
          </Button>
        </div>
      ) : (
        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 pl-10"
                placeholder="seu.email@empresa.com"
              />
            </div>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar link de redefinição"
            )}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
            Voltar ao login
          </Button>
        </form>
      )}
    </div>
  );
}

function ResetPasswordForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (password: string) => Promise<{ error: string | null }>;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setBusy(true);
    const { error } = await onSubmit(password);
    setBusy(false);
    if (error) {
      toast.error("Erro ao redefinir senha", { description: error });
      return;
    }
    toast.success("Senha atualizada", {
      description: "Você já pode usar a nova senha para acessar o sistema.",
    });
    onDone();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Nova senha</h2>
        <p className="text-sm text-muted-foreground">
          Defina uma nova senha para concluir a recuperação da conta.
        </p>
      </div>

      <form onSubmit={handle} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">Nova senha</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="h-11 pl-10 pr-10"
            />
            <button
              type="button"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirmar nova senha</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-confirm"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="h-11 pl-10"
            />
          </div>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar nova senha"
          )}
        </Button>
      </form>
    </div>
  );
}
