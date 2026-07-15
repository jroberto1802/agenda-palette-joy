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

function PersonAvatar({ person }: { person: TarefaPeopleMini }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0" aria-label={person.nome_completo}>
          <ProfileAvatar
            name={person.nome_completo}
            avatarUrl={person.avatar_url}
            className="h-6 w-6 border border-background"
            fallbackClassName="text-[9px]"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className={OVERLAY_Z}>
        <p className="text-xs">{person.nome_completo}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function PersonStack({ people }: { people: TarefaPeopleMini[] }) {
  if (people.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex -space-x-1.5">
      {people.map((person) => (
        <PersonAvatar key={person.id} person={person} />
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
  className,
}: {
  criador?: TarefaPeopleMini | null;
  createdAt?: string | Date | null;
  responsaveis: TarefaPeopleMini[];
  visibilidade: TarefaVisibilidade;
  visualizadores: TarefaPeopleMini[];
  setorNome?: string | null;
  projetoNome?: string | null;
  className?: string;
}) {
  const showVisualizadores = visibilidade !== "somente_para_mim";
  const createdLabel =
    createdAt != null
      ? format(createdAt instanceof Date ? createdAt : new Date(createdAt), "dd MMM yyyy", {
          locale: ptBR,
        })
      : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/20 px-3 py-2",
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            Criado por
          </span>
          {criador ? (
            <div className="flex items-center gap-1.5">
              <PersonAvatar person={criador} />
              {createdLabel && (
                <span className="text-[11px] text-muted-foreground">{createdLabel}</span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            Responsável
          </span>
          <PersonStack people={responsaveis} />
        </div>

        {showVisualizadores && (
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              Visualizadores
            </span>
            {visibilidade === "pessoas_especificas" ? (
              <PersonStack people={visualizadores} />
            ) : (
              <span className="truncate text-[11px] font-medium text-foreground">
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
