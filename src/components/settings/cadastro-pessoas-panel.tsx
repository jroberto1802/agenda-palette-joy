import { KeyRound, Pencil, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { PessoaDesativarTransferDialog } from "@/components/pessoas/pessoa-desativar-transfer-dialog";
import { PessoaFormDialog } from "@/components/pessoas/pessoa-form-dialog";
import { RestaurarSenhaDialog } from "@/components/pessoas/restaurar-senha-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRestaurarSenhaUsuario } from "@/hooks/use-admin";
import {
  useCreatePessoa,
  useDeletePessoa,
  useDesativarPessoa,
  usePessoas,
  useReativarPessoa,
  useUpdatePessoa,
} from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  listAtividadesDoResponsavel,
  type PessoaAtividadeTransferivel,
} from "@/services/pessoas";
import type { ProfileFormData, ProfileWithSetor } from "@/types";
import {
  PAPEL_LABELS,
  canRestaurarSenha,
  hasSenhaTemporaria,
} from "@/utils/permissions";

type PessoasTab = "ativas" | "desativadas";

export function CadastroPessoasPanel({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<PessoasTab>("ativas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileWithSetor | null>(null);
  const [deleting, setDeleting] = useState<ProfileWithSetor | null>(null);
  const [restaurando, setRestaurando] = useState<ProfileWithSetor | null>(null);
  const [transferPessoa, setTransferPessoa] = useState<ProfileWithSetor | null>(null);
  const [transferAtividades, setTransferAtividades] = useState<PessoaAtividadeTransferivel[]>(
    [],
  );

  const { data: profile } = useProfile();
  const { data: pessoas, isLoading } = usePessoas(debouncedSearch);
  const { data: todasPessoas } = usePessoas();
  const { data: setores } = useSetores();
  const createPessoa = useCreatePessoa();
  const updatePessoa = useUpdatePessoa();
  const desativarPessoa = useDesativarPessoa();
  const reativarPessoa = useReativarPessoa();
  const deletePessoa = useDeletePessoa();
  const restaurarSenha = useRestaurarSenhaUsuario();

  const handleSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (value: string) => {
      setSearch(value);
      clearTimeout(timeout);
      timeout = setTimeout(() => setDebouncedSearch(value), 300);
    };
  }, []);

  const gestores = useMemo(
    () =>
      (todasPessoas ?? [])
        .filter((p) => p.ativo && (p.papel === "gerente" || p.papel === "admin"))
        .map((p) => ({ id: p.id, nome_completo: p.nome_completo, papel: p.papel })),
    [todasPessoas],
  );

  const activeAdminCount = useMemo(
    () => (todasPessoas ?? []).filter((p) => p.papel === "admin" && p.ativo).length,
    [todasPessoas],
  );
  const pessoasById = useMemo(
    () => new Map((todasPessoas ?? []).map((pessoa) => [pessoa.id, pessoa])),
    [todasPessoas],
  );

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );
  const pessoasDesativadas = useMemo(
    () => (pessoas ?? []).filter((p) => !p.ativo),
    [pessoas],
  );

  const candidatosTransferencia = useMemo(
    () => (todasPessoas ?? []).filter((p) => p.ativo),
    [todasPessoas],
  );

  const handleSave = async (data: ProfileFormData) => {
    try {
      if (editing) {
        await updatePessoa.mutateAsync({
          id: editing.id,
          data: { ...data, ativo: editing.ativo },
        });
        toast.success("Pessoa atualizada");
      } else {
        await createPessoa.mutateAsync({ ...data, ativo: true });
        toast.success("Pessoa criada");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error(editing ? "Erro ao salvar pessoa" : "Erro ao criar pessoa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDesativar = async (pessoa: ProfileWithSetor) => {
    if (pessoa.papel === "admin" && activeAdminCount <= 1) {
      toast.error("Não é possível desativar o último Administrador do sistema.");
      return;
    }
    try {
      const atividades = await listAtividadesDoResponsavel(pessoa.id);
      if (atividades.length > 0) {
        setTransferPessoa(pessoa);
        setTransferAtividades(atividades);
        return;
      }
      await desativarPessoa.mutateAsync({ id: pessoa.id });
      toast.success("Pessoa desativada");
    } catch (error) {
      toast.error("Erro ao desativar pessoa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleReativar = async (pessoa: ProfileWithSetor) => {
    try {
      await reativarPessoa.mutateAsync(pessoa.id);
      toast.success("Pessoa reativada");
      setTab("ativas");
    } catch (error) {
      toast.error("Erro ao reativar pessoa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deletePessoa.mutateAsync(deleting.id);
      toast.success("Pessoa excluída");
      setDeleting(null);
    } catch (error) {
      toast.error("Erro ao excluir pessoa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const requestDelete = (pessoa: ProfileWithSetor) => {
    if (pessoa.papel === "admin" && pessoa.ativo && activeAdminCount <= 1) {
      toast.error("Não é possível excluir o último Administrador do sistema.");
      return;
    }
    setDeleting(pessoa);
  };

  const handleRestaurarSenha = async (password: string) => {
    if (!restaurando) return;
    try {
      await restaurarSenha.mutateAsync({
        user_id: restaurando.id,
        password,
      });
      toast.success("Senha restaurada", {
        description: `${restaurando.nome_completo} deverá definir uma nova senha em até 3 dias.`,
      });
      setRestaurando(null);
    } catch (error) {
      toast.error("Erro ao restaurar senha", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const renderTable = (lista: ProfileWithSetor[], emptyLabel: string) => {
    if (!lista.length) {
      return (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">{emptyLabel}</p>
          {canManage && tab === "ativas" && (
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Cadastrar primeira pessoa
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / E-mail</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Gestor responsável</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((pessoa) => (
              <TableRow key={pessoa.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar
                      name={pessoa.nome_completo}
                      avatarUrl={pessoa.avatar_url}
                      ativo={pessoa.ativo}
                      className="h-9 w-9"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{pessoa.nome_completo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pessoa.email || "—"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {pessoa.setor ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: pessoa.setor.cor ?? "#94a3b8" }}
                      />
                      {pessoa.setor.nome}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary">{PAPEL_LABELS[pessoa.papel]}</Badge>
                    {hasSenhaTemporaria(pessoa) && (
                      <Badge variant="outline" className="border-amber-500 text-amber-700">
                        Senha temporária
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {(pessoa.gestor?.nome_completo ??
                    (pessoa.gestor_id
                      ? pessoasById.get(pessoa.gestor_id)?.nome_completo
                      : null)) ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {pessoa.ativo ? (
                    <Badge variant="outline" className="border-green-600 text-green-700">
                      Ativa
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Desativada</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      {pessoa.ativo && canRestaurarSenha(profile, pessoa) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRestaurando(pessoa)}
                          aria-label="Restaurar senha"
                          title="Restaurar senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(pessoa);
                          setDialogOpen(true);
                        }}
                        aria-label="Editar pessoa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {pessoa.ativo ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDesativar(pessoa)}
                          aria-label="Desativar pessoa"
                          title="Desativar"
                          disabled={desativarPessoa.isPending}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleReativar(pessoa)}
                          aria-label="Reativar pessoa"
                          title="Reativar"
                          disabled={reativarPessoa.isPending}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => requestDelete(pessoa)}
                        aria-label="Excluir pessoa"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pessoas</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre colaboradores com setor, papel e gestor responsável. Desative o acesso
            sem apagar o histórico.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="shrink-0 gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova pessoa
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          className="pl-9"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PessoasTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="ativas">
            Ativas
            {!isLoading && (
              <span className="ml-1.5 text-muted-foreground">({pessoasAtivas.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="desativadas">
            Desativadas
            {!isLoading && (
              <span className="ml-1.5 text-muted-foreground">
                ({pessoasDesativadas.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <>
            <TabsContent value="ativas" className="mt-0">
              {renderTable(pessoasAtivas, "Nenhuma pessoa ativa encontrada.")}
            </TabsContent>
            <TabsContent value="desativadas" className="mt-0">
              {renderTable(pessoasDesativadas, "Nenhuma pessoa desativada.")}
            </TabsContent>
          </>
        )}
      </Tabs>

      {canManage && (
        <PessoaFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          pessoa={editing}
          setores={setores ?? []}
          gestores={gestores}
          onSubmit={handleSave}
          loading={createPessoa.isPending || updatePessoa.isPending}
        />
      )}

      <PessoaDesativarTransferDialog
        open={!!transferPessoa}
        onOpenChange={(open) => {
          if (!open) {
            setTransferPessoa(null);
            setTransferAtividades([]);
          }
        }}
        pessoa={transferPessoa}
        atividades={transferAtividades}
        candidatos={candidatosTransferencia}
      />

      <RestaurarSenhaDialog
        open={!!restaurando}
        onOpenChange={(open) => {
          if (!open) setRestaurando(null);
        }}
        pessoaNome={restaurando?.nome_completo}
        onSubmit={handleRestaurarSenha}
        loading={restaurarSenha.isPending}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        itemKind="pessoa"
        itemName={deleting?.nome_completo}
        onConfirm={handleDelete}
      />
    </div>
  );
}
