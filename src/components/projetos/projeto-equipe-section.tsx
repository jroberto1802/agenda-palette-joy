import { Plus, UserMinus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { ProjetoMembroTransferDialog } from "@/components/projetos/projeto-membro-transfer-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddProjetoMembro,
  useRemoveProjetoMembro,
} from "@/hooks/use-projetos";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { listAtividadesDoMembroNoProjeto, type ProjetoAtividadeTransferivel } from "@/services/projetos";
import type { ProfileWithSetor, ProjetoMembro } from "@/types";
import { PAPEL_LABELS } from "@/utils/permissions";

export function ProjetoEquipeSection({
  projetoId,
  membros,
  pessoas,
  canManage,
  embedded = false,
}: {
  projetoId: string;
  membros: ProjetoMembro[];
  pessoas: ProfileWithSetor[];
  canManage: boolean;
  /** Remove borda/título quando usado dentro do sheet de equipe. */
  embedded?: boolean;
}) {
  const [addingId, setAddingId] = useState<string>("");
  const [transferMembro, setTransferMembro] = useState<ProjetoMembro | null>(null);
  const [transferAtividades, setTransferAtividades] = useState<ProjetoAtividadeTransferivel[]>(
    [],
  );
  const addMembro = useAddProjetoMembro();
  const removeMembro = useRemoveProjetoMembro();

  const disponiveis = useMemo(() => {
    const memberIds = new Set(membros.map((m) => m.id));
    return pessoas.filter((p) => p.ativo && !memberIds.has(p.id));
  }, [pessoas, membros]);

  /** Novos responsáveis na transferência: só membros atuais do projeto. */
  const candidatosTransferencia = useMemo(() => {
    const memberIds = new Set(membros.map((m) => m.id));
    return pessoas.filter((p) => p.ativo && memberIds.has(p.id));
  }, [pessoas, membros]);

  const handleAdd = async () => {
    if (!addingId) return;
    try {
      await addMembro.mutateAsync({ projetoId, usuarioId: addingId });
      toast.success("Pessoa adicionada à equipe");
      setAddingId("");
    } catch (error) {
      toast.error("Erro ao adicionar membro", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleRemove = async (membro: ProjetoMembro) => {
    try {
      const atividades = await listAtividadesDoMembroNoProjeto(projetoId, membro.id);
      if (atividades.length > 0) {
        setTransferMembro(membro);
        setTransferAtividades(atividades);
        return;
      }
      await removeMembro.mutateAsync({ projetoId, usuarioId: membro.id });
      toast.success("Pessoa removida da equipe");
    } catch (error) {
      toast.error("Erro ao remover membro", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const addControls =
    canManage && disponiveis.length > 0 ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={addingId || undefined} onValueChange={setAddingId}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Adicionar pessoa" />
          </SelectTrigger>
          <SelectContent>
            {disponiveis.map((pessoa) => (
              <SelectItem key={pessoa.id} value={pessoa.id}>
                {pessoa.nome_completo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!addingId || addMembro.isPending}
          onClick={() => void handleAdd()}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>
    ) : null;

  return (
    <section className={embedded ? "space-y-3" : "space-y-3 rounded-xl border p-4"}>
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Equipe do projeto</h2>
            <p className="text-sm text-muted-foreground">
              {membros.length === 0
                ? "Nenhum membro vinculado ainda."
                : `${membros.length} ${membros.length === 1 ? "membro" : "membros"}`}
            </p>
          </div>
          {addControls}
        </div>
      )}

      {embedded && addControls}

      {!canManage && (
        <p className="text-xs text-muted-foreground">
          Somente o criador do projeto, gestores participantes ou administradores podem
          alterar a equipe.
        </p>
      )}

      {membros.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Defina a equipe para poder atribuir responsáveis às tarefas deste projeto.
        </p>
      ) : (
        <ul
          className={
            embedded
              ? "grid grid-cols-1 gap-2"
              : "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {membros.map((membro) => (
            <li
              key={membro.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ProfileAvatar
                  name={membro.nome_completo}
                  avatarUrl={membro.avatar_url}
                  className="h-8 w-8"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{membro.nome_completo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {membro.cargo || PAPEL_LABELS[membro.papel]}
                  </p>
                </div>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label={`Remover ${membro.nome_completo}`}
                  disabled={removeMembro.isPending}
                  onClick={() => void handleRemove(membro)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ProjetoMembroTransferDialog
        open={!!transferMembro}
        onOpenChange={(next) => {
          if (!next) {
            setTransferMembro(null);
            setTransferAtividades([]);
          }
        }}
        projetoId={projetoId}
        membro={transferMembro}
        atividades={transferAtividades}
        candidatos={candidatosTransferencia}
      />
    </section>
  );
}
