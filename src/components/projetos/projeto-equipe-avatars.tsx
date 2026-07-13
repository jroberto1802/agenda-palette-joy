import { ProfileAvatar } from "@/components/common/profile-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProjetoMembro } from "@/types";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 6;

export function ProjetoEquipeAvatars({
  membros,
  onClick,
  className,
}: {
  membros: ProjetoMembro[];
  onClick?: () => void;
  className?: string;
}) {
  if (membros.length === 0) return null;

  const visiveis = membros.slice(0, MAX_VISIBLE);
  const restantes = membros.length - visiveis.length;

  return (
    <TooltipProvider delayDuration={200}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label={`Ver equipe do projeto (${membros.length} ${membros.length === 1 ? "pessoa" : "pessoas"})`}
      >
        <div className="flex -space-x-2">
          {visiveis.map((membro) => (
            <Tooltip key={membro.id}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ProfileAvatar
                    name={membro.nome_completo}
                    avatarUrl={membro.avatar_url}
                    className="h-8 w-8 border-2 border-background"
                    fallbackClassName="text-[10px]"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{membro.nome_completo}</TooltipContent>
            </Tooltip>
          ))}
          {restantes > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                  +{restantes}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Mais {restantes} {restantes === 1 ? "pessoa" : "pessoas"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </button>
    </TooltipProvider>
  );
}
