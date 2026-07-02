import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import {
  useEnrollTotp,
  useMfaFactors,
  useUnenrollFactor,
  useVerifyTotpEnrollment,
} from "@/hooks/use-mfa";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Agenda" },
      { name: "description", content: "Segurança da conta e autenticação em dois fatores." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: profile } = useProfile();
  const { data: factors, isLoading } = useMfaFactors();
  const enrollTotp = useEnrollTotp();
  const verifyEnrollment = useVerifyTotpEnrollment();
  const unenroll = useUnenrollFactor();

  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const verifiedFactor = factors?.totp.find((f) => f.status === "verified") ?? null;
  const has2FA = !!verifiedFactor;

  const handleStartEnroll = async () => {
    try {
      const data = await enrollTotp.mutateAsync("Autenticador");
      if (data.type === "totp" && data.totp) {
        setEnrollment({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
        setVerifyCode("");
      }
    } catch (error) {
      toast.error("Erro ao iniciar 2FA", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollment || verifyCode.length < 6) return;
    try {
      await verifyEnrollment.mutateAsync({
        factorId: enrollment.factorId,
        code: verifyCode,
      });
      setEnrollment(null);
      setVerifyCode("");
      toast.success("Autenticação em dois fatores ativada!");
    } catch (error) {
      toast.error("Código inválido", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDisable2FA = async () => {
    if (!verifiedFactor) return;
    try {
      await unenroll.mutateAsync(verifiedFactor.id);
      toast.success("2FA desativado");
    } catch (error) {
      toast.error("Erro ao desativar 2FA", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie a segurança da sua conta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Perfil</CardTitle>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Nome:</span>{" "}
            {profile?.nome_completo ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Papel:</span> {profile?.papel ?? "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {has2FA ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
            Autenticação em dois fatores (2FA)
          </CardTitle>
          <CardDescription>
            Proteja sua conta com um código TOTP do aplicativo autenticador (Google
            Authenticator, Authy, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : has2FA ? (
            <div className="space-y-4">
              <p className="text-sm text-green-700 dark:text-green-400">
                2FA está ativo no fator &quot;{verifiedFactor.friendly_name}&quot;.
              </p>
              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={unenroll.isPending}
              >
                {unenroll.isPending ? "Desativando..." : "Desativar 2FA"}
              </Button>
            </div>
          ) : enrollment ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR code no seu aplicativo autenticador e digite o código de 6
                dígitos.
              </p>
              <div
                className="flex justify-center p-4 bg-white rounded-lg border w-fit mx-auto"
                dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
              />
              <p className="text-xs text-muted-foreground text-center break-all">
                Chave manual: <code>{enrollment.secret}</code>
              </p>
              <div className="space-y-2 max-w-xs mx-auto">
                <Label htmlFor="verify-code">Código de verificação</Label>
                <Input
                  id="verify-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleVerifyEnrollment}
                    disabled={verifyCode.length < 6 || verifyEnrollment.isPending}
                  >
                    {verifyEnrollment.isPending ? "Verificando..." : "Confirmar"}
                  </Button>
                  <Button variant="outline" onClick={() => setEnrollment(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={handleStartEnroll} disabled={enrollTotp.isPending}>
              {enrollTotp.isPending ? "Preparando..." : "Ativar 2FA"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
