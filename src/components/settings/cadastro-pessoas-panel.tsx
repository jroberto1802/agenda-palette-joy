import { Pencil, Plus, Search, Trash2, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
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
import { PessoaFormDialog } from "@/components/pessoas/pessoa-form-dialog";
import {
  useCreatePessoa,
  useDeletePessoa,
  usePessoas,
  useUpdatePessoa,
} from "@/hooks/use-pessoas";
import { useSetores } from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { ProfileFormData, ProfileWithSetor } from "@/types";
import { PAPEL_LABELS } from "@/utils/permissions";

export function CadastroPessoasPanel({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileWithSetor | null>(null);
  const [deleting, setDeleting] = useState<ProfileWithSetor | null>(null);

  const { data: pessoas, isLoading } = usePessoas(debouncedSearch);
  const { data: todasPessoas } = usePessoas();
  const { data: setores } = useSetores();
  const createPessoa = useCreatePessoa();
  const updatePessoa = useUpdatePessoa();
  const deletePessoa = useDeletePessoa();

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

  const handleSave = async (data: ProfileFormData) => {
    try {
      if (editing) {
        await updatePessoa.mutateAsync({ id: editing.id, data });
        toast.success("Pessoa atualizada");
      } else {
        await createPessoa.mutateAsync(data);
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

  const handleToggleAtivo = async (pessoa: ProfileWithSetor) => {
    if (pessoa.ativo && pessoa.papel === "admin" && activeAdminCount <= 1) {
      toast.error("Não é possível inativar o último Administrador do sistema.");
      return;
    }
    try {
      await updatePessoa.mutateAsync({
        id: pessoa.id,
        data: {
          nome_completo: pessoa.nome_completo,
          setor_id: pessoa.setor_id,
          papel: pessoa.papel,
          gestor_id: pessoa.gestor_id,
          ativo: !pessoa.ativo,
        },
      });
      toast.success(pessoa.ativo ? "Pessoa inativada" : "Pessoa reativada");
    } catch (error) {
      toast.error("Erro ao alterar status", {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pessoas</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre colaboradores com setor, papel e gestor responsável.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-2 shrink-0"
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

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : !pessoas?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhuma pessoa encontrada.</p>
          {canManage && (
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
      ) : (
        <div className="rounded-xl border overflow-x-auto">
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
              {pessoas.map((pessoa) => (
                <TableRow key={pessoa.id} className={!pessoa.ativo ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <ProfileAvatar
                        name={pessoa.nome_completo}
                        avatarUrl={pessoa.avatar_url}
                        className="h-9 w-9"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{pessoa.nome_completo}</p>
                        <p className="text-xs text-muted-foreground truncate">
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
                    <Badge variant="secondary">{PAPEL_LABELS[pessoa.papel]}</Badge>
                  </TableCell>
                  <TableCell>
                    {(pessoa.gestor?.nome_completo ??
                      (pessoa.gestor_id ? pessoasById.get(pessoa.gestor_id)?.nome_completo : null)) ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pessoa.ativo ? (
                      <Badge variant="outline" className="border-green-600 text-green-700">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleAtivo(pessoa)}
                          aria-label={pessoa.ativo ? "Inativar pessoa" : "Reativar pessoa"}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
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
      )}

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
