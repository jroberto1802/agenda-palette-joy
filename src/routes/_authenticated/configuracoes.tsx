import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CadastroPessoasPanel } from "@/components/settings/cadastro-pessoas-panel";
import { CadastroSetoresPanel } from "@/components/settings/cadastro-setores-panel";
import { ThemeSettingsCard } from "@/components/settings/theme-settings-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEnrollTotp,
  useMfaFactors,
  useUnenrollFactor,
  useVerifyTotpEnrollment,
} from "@/hooks/use-mfa";
import { useProfile } from "@/hooks/use-profile";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { canManagePessoas, canManageSetores, isAdmin, PAPEL_LABELS } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — CoreGestor" },
      {
        name: "description",
        content: "Cadastros, aparência e segurança da conta.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: profile, isLoading: loadingProfile, error: profileError } = useProfile();
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
  const showCadastros = isAdmin(profile);
  const canManage = canManageSetores(profile) && canManagePessoas(profile);

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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie cadastros, aparência e segurança da sua conta.
        </p>
      </div>

      <Tabs defaultValue={showCadastros ? "cadastros" : "conta"}>
        <TabsList>
          {showCadastros && <TabsTrigger value="cadastros">Cadastros</TabsTrigger>}
          <TabsTrigger value="conta">Conta</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        {showCadastros && (
          <TabsContent value="cadastros" className="space-y-8 mt-6">
            <Tabs defaultValue="setores">
              <TabsList>
                <TabsTrigger value="setores">Setores</TabsTrigger>
                <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
              </TabsList>
              <TabsContent value="setores" className="mt-4">
                <CadastroSetoresPanel canManage={canManage} />
              </TabsContent>
              <TabsContent value="pessoas" className="mt-4">
                <CadastroPessoasPanel canManage={canManage} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        <TabsContent value="conta" className="space-y-6 mt-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Perfil</CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {loadingProfile ? (
                <Skeleton className="h-10 w-full" />
              ) : profileError ? (
                <p className="text-destructive">
                  Não foi possível carregar o perfil. Atualize a página.
                </p>
              ) : (
                <>
                  <p>
                    <span className="text-muted-foreground">Nome:</span>{" "}
                    {profile?.nome_completo ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Papel:</span>{" "}
                    {profile?.papel ? PAPEL_LABELS[profile.papel] : "—"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <ThemeSettingsCard />
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6 max-w-2xl">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
