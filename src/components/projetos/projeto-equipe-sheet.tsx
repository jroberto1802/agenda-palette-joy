import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjetoEquipeSection } from "@/components/projetos/projeto-equipe-section";
import type { ProfileWithSetor, ProjetoMembro } from "@/types";

export function ProjetoEquipeSheet({
  open,
  onOpenChange,
  projetoId,
  projetoNome,
  membros,
  pessoas,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoNome: string;
  membros: ProjetoMembro[];
  pessoas: ProfileWithSetor[];
  canManage: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[90vw] max-w-lg flex-col gap-0 overflow-hidden rounded-xl p-0 sm:rounded-xl">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 pr-12 text-left">
          <DialogTitle>Equipe do projeto</DialogTitle>
          <DialogDescription>
            Membros de &quot;{projetoNome}&quot;. Alterações refletem na tela em tempo real.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ProjetoEquipeSection
            projetoId={projetoId}
            membros={membros}
            pessoas={pessoas}
            canManage={canManage}
            embedded
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
