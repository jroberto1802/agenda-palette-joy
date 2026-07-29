import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TarefaVisibilidade } from "@/types";

/** Acima de Dialog/Sheet e do drawer de subtarefa. */
const OVERLAY_Z = "z-[100]";

export type TarefaPeopleMini = {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
};

function PersonAvatar({
  person,
  compact = false,
}: {
  person: TarefaPeopleMini;
  compact?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0" aria-label={person.nome_completo}>
          <ProfileAvatar
            name={person.nome_completo}
            avatarUrl={person.avatar_url}
            className={cn(
              "border border-background",
              compact ? "h-5 w-5" : "h-6 w-6",
            )}
            fallbackClassName={compact ? "text-[8px]" : "text-[9px]"}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className={OVERLAY_Z}>
        <p className="text-xs">{person.nome_completo}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function PersonStack({
  people,
  compact = false,
}: {
  people: TarefaPeopleMini[];
  compact?: boolean;
}) {
  if (people.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className={cn("flex", compact ? "-space-x-1" : "-space-x-1.5")}>
      {people.map((person) => (
        <PersonAvatar key={person.id} person={person} compact={compact} />
      ))}
    </div>
  );
}

function GroupLabel({
  visibilidade,
  setorNome,
  projetoNome,
}: {
  visibilidade: TarefaVisibilidade;
  setorNome?: string | null;
  projetoNome?: string | null;
}) {
  if (visibilidade === "todos_empresa") return <>Todos</>;
  if (visibilidade === "todos_setor") {
    return <>{setorNome ? `Setor ${setorNome}` : "Todos do setor"}</>;
  }
  if (visibilidade === "todos_projeto") {
    return <>{projetoNome ? `Projeto ${projetoNome}` : "Todos do projeto"}</>;
  }
  return null;
}

/**
 * Faixa minimalista de autoria / responsáveis / visualizadores
 * (somente leitura), usada na tarefa e na subtarefa.
 */
export function TarefaPeopleStrip({
  criador,
  createdAt,
  responsaveis,
  visibilidade,
  visualizadores,
  setorNome,
  projetoNome,
  compact = false,
  className,
}: {
  criador?: TarefaPeopleMini | null;
  createdAt?: string | Date | null;
  responsaveis: TarefaPeopleMini[];
  visibilidade: TarefaVisibilidade;
  visualizadores: TarefaPeopleMini[];
  setorNome?: string | null;
  projetoNome?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const showVisualizadores = true;
  const createdLabel =
    createdAt != null
      ? format(createdAt instanceof Date ? createdAt : new Date(createdAt), "dd MMM yyyy", {
          locale: ptBR,
        })
      : null;

  const labelClass = compact
    ? "shrink-0 text-[10px] font-medium text-muted-foreground"
    : "shrink-0 text-[11px] font-medium text-muted-foreground";
  const mutedClass = compact ? "text-[10px] text-muted-foreground" : "text-[11px] text-muted-foreground";

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex flex-wrap items-center border bg-muted/20",
          compact
            ? "gap-x-3 gap-y-1.5 rounded-lg px-2 py-1.5"
            : "gap-x-4 gap-y-2 rounded-xl px-3 py-2",
          className,
        )}
      >
        <div className={cn("flex min-w-0 items-center", compact ? "gap-1.5" : "gap-2")}>
          <span className={labelClass}>Criado por</span>
          {criador ? (
            <div className="flex items-center gap-1.5">
              <PersonAvatar person={criador} compact={compact} />
              {createdLabel && <span className={mutedClass}>{createdLabel}</span>}
            </div>
          ) : (
            <span className={mutedClass}>—</span>
          )}
        </div>

        <div className={cn("flex min-w-0 items-center", compact ? "gap-1.5" : "gap-2")}>
          <span className={labelClass}>Responsável</span>
          <PersonStack people={responsaveis} compact={compact} />
        </div>

        {showVisualizadores && (
          <div className={cn("flex min-w-0 items-center", compact ? "gap-1.5" : "gap-2")}>
            <span className={labelClass}>Visualizadores</span>
            {visibilidade === "pessoas_especificas" ? (
              <PersonStack people={visualizadores} compact={compact} />
            ) : (
              <span
                className={cn(
                  "truncate font-medium text-foreground",
                  compact ? "text-[10px]" : "text-[11px]",
                )}
              >
                <GroupLabel
                  visibilidade={visibilidade}
                  setorNome={setorNome}
                  projetoNome={projetoNome}
                />
              </span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
