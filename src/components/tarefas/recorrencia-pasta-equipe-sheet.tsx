import { useState } from "react";
import { toast } from "sonner";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSetRecorrenciaPastaMembros } from "@/hooks/use-recorrencia-pastas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { RecorrenciaPasta, RecorrenciaPastaMembro } from "@/services/recorrencia-pastas";
import type { ProfileWithSetor } from "@/types";

export function RecorrenciaPastaEquipeSheet({
  open,
  onOpenChange,
  pasta,
  membros,
  pessoas,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta: RecorrenciaPasta;
  membros: RecorrenciaPastaMembro[];
  pessoas: ProfileWithSetor[];
  canManage: boolean;
}) {
  const setMembros = useSetRecorrenciaPastaMembros();
  const [membroIds, setMembroIds] = useState<string[]>(() => membros.map((m) => m.id));
  const [editing, setEditing] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setMembroIds(membros.map((m) => m.id));
      setEditing(false);
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    try {
      await setMembros.mutateAsync({ pastaId: pasta.id, usuarioIds: membroIds });
      toast.success("Participantes atualizados");
      setEditing(false);
    } catch (error) {
      toast.error("Erro ao salvar participantes", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Participantes — {pasta.nome}</SheetTitle>
          <SheetDescription>
            Participar da pasta organiza as séries, mas não libera o acesso ao modelo.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
          {editing && canManage ? (
            <PessoasMultiSelect
              pessoas={pessoas}
              value={membroIds}
              onChange={setMembroIds}
              placeholder="Adicionar pessoas"
              emptyLabel="Nenhuma pessoa"
              searchPlaceholder="Buscar…"
              inline
              showSelectAll
            />
          ) : membros.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhum participante ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {membros.map((membro) => (
                <li
                  key={membro.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <ProfileAvatar
                    name={membro.nome_completo}
                    avatarUrl={membro.avatar_url}
                    className="h-8 w-8"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{membro.nome_completo}</p>
                    {membro.cargo && (
                      <p className="truncate text-xs text-muted-foreground">{membro.cargo}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage && (
          <div className="mt-4 flex gap-2 border-t pt-4">
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMembroIds(membros.map((m) => m.id));
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={setMembros.isPending}
                  onClick={() => void handleSave()}
                >
                  Salvar
                </Button>
              </>
            ) : (
              <Button type="button" className="w-full" onClick={() => setEditing(true)}>
                Gerenciar participantes
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
