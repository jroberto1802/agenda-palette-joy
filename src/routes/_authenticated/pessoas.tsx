import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PessoaCard } from "@/components/pessoas/pessoa-card";
import { PessoaFormDialog } from "@/components/pessoas/pessoa-form-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePessoas, useUpdatePessoa } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { ProfileFormData, ProfileWithSetor } from "@/types";
import { canManagePessoas, isAdmin } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/pessoas")({
  component: PessoasPage,
});

function PessoasPage() {
  const { data: profile } = useProfile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<ProfileWithSetor | null>(null);

  const { data: pessoas, isLoading } = usePessoas(debouncedSearch);
  const { data: setores } = useSetores();
  const updatePessoa = useUpdatePessoa();

  const canEditAny = canManagePessoas(profile);
  const canEditRole = isAdmin(profile);

  const handleSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (value: string) => {
      setSearch(value);
      clearTimeout(timeout);
      timeout = setTimeout(() => setDebouncedSearch(value), 300);
    };
  }, []);

  const canEditPessoa = (pessoa: ProfileWithSetor) => {
    if (!canEditAny) return false;
    if (isAdmin(profile)) return true;
    if (profile?.papel === "gerente") {
      return pessoa.setor_id === profile.setor_id && pessoa.papel !== "admin";
    }
    return false;
  };

  const handleSave = async (data: ProfileFormData) => {
    if (!editing) return;
    try {
      await updatePessoa.mutateAsync({ id: editing.id, data });
      toast.success("Pessoa atualizada");
      setEditing(null);
    } catch (error) {
      toast.error("Erro ao salvar", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Colaboradores da empresa vinculados à sua conta.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou cargo..."
          className="pl-9"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : !pessoas?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhuma pessoa encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pessoas.map((pessoa) => (
            <PessoaCard
              key={pessoa.id}
              pessoa={pessoa}
              canEdit={canEditPessoa(pessoa)}
              onEdit={() => setEditing(pessoa)}
            />
          ))}
        </div>
      )}

      <PessoaFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        pessoa={editing}
        setores={setores ?? []}
        canEditRole={canEditRole}
        onSubmit={handleSave}
        loading={updatePessoa.isPending}
      />
    </div>
  );
}
