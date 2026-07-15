import { Building2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmpresaConfig, useUpdateEmpresaConfig } from "@/hooks/use-empresa";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { EMPRESA_NOME_PADRAO } from "@/services/empresa";

export function EmpresaSettingsCard({ canEdit }: { canEdit: boolean }) {
  const { data: empresa, isLoading } = useEmpresaConfig();
  const updateEmpresa = useUpdateEmpresaConfig();

  const [nome, setNome] = useState(EMPRESA_NOME_PADRAO);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);

  useEffect(() => {
    if (!empresa) return;
    setNome(empresa.nome);
    setLogoPreview(empresa.logo_url);
    setLogoFile(null);
    setRemoveLogo(false);
  }, [empresa]);

  const handleSave = async () => {
    try {
      await updateEmpresa.mutateAsync({
        nome,
        logo_file: logoFile,
        remove_logo: removeLogo && !logoFile,
      });
      setLogoFile(null);
      setRemoveLogo(false);
      toast.success("Dados da empresa salvos");
    } catch (error) {
      toast.error("Erro ao salvar empresa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const dirty =
    nome.trim() !== (empresa?.nome ?? EMPRESA_NOME_PADRAO).trim() ||
    !!logoFile ||
    removeLogo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Empresa
        </CardTitle>
        <CardDescription>
          Nome e logo exibidos no menu lateral para todos os usuários.
          {!canEdit && " Apenas Administrador pode editar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="empresa-nome">Nome da empresa</Label>
              <Input
                id="empresa-nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder={EMPRESA_NOME_PADRAO}
                disabled={!canEdit || updateEmpresa.isPending}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="empresa-logo">Logo</Label>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {logoPreview && !removeLogo ? (
                    <img
                      src={logoPreview}
                      alt="Logo da empresa"
                      className="size-full object-contain"
                    />
                  ) : (
                    <Building2 className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    id="empresa-logo"
                    type="file"
                    accept="image/*"
                    disabled={!canEdit || updateEmpresa.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setLogoFile(file);
                      setRemoveLogo(false);
                      if (file) {
                        setLogoPreview(URL.createObjectURL(file));
                      } else {
                        setLogoPreview(empresa?.logo_url ?? null);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG ou JPG recomendados. Sem logo, o ícone padrão do sistema é usado.
                  </p>
                  {canEdit && logoPreview && !removeLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 px-0 text-muted-foreground"
                      onClick={() => setConfirmRemoveLogo(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!dirty || !nome.trim() || updateEmpresa.isPending}
                >
                  {updateEmpresa.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ConfirmDeleteDialog
        open={confirmRemoveLogo}
        onOpenChange={setConfirmRemoveLogo}
        itemKind="logo"
        title="Remover logo?"
        description='Excluir a logo da empresa? A remoção será aplicada ao salvar. Esta ação não pode ser desfeita após o salvamento.'
        confirmLabel="Remover"
        onConfirm={() => {
          setLogoFile(null);
          setRemoveLogo(true);
          setLogoPreview(null);
        }}
      />
    </Card>
  );
}
