import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Equipe do projeto</SheetTitle>
          <SheetDescription>
            Membros de &quot;{projetoNome}&quot;. Alterações refletem na tela em tempo real.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProjetoEquipeSection
            projetoId={projetoId}
            membros={membros}
            pessoas={pessoas}
            canManage={canManage}
            embedded
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
