import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useTarefas } from "@/hooks/use-tarefas";
import { CARD_GRID_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { ProfileWithSetor, TarefaWithRelations } from "@/types";
import { isAdminOrGerente } from "@/utils/permissions";
import { getTarefaResponsaveis } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — CoreGestor" },
      { name: "description", content: "Visão da equipe por setor e acesso às agendas." },
    ],
  }),
  component: EquipePage,
});

type SetorGrupo = {
  id: string;
  nome: string;
  pessoas: ProfileWithSetor[];
};

function countTarefasDaPessoa(
  pessoaId: string,
  tarefas: TarefaWithRelations[] | undefined,
): number {
  let total = 0;
  for (const tarefa of tarefas ?? []) {
    const responsavelIds = getTarefaResponsaveis(tarefa).map((r) => r.id);
    if (responsavelIds.length === 0 && tarefa.atribuido_a) {
      responsavelIds.push(tarefa.atribuido_a);
    }
    if (responsavelIds.includes(pessoaId)) total += 1;
  }
  return total;
}

function EquipePessoaCard({
  pessoa,
  totalTarefas,
  showContador,
  canOpenAgenda,
}: {
  pessoa: ProfileWithSetor;
  totalTarefas: number;
  showContador: boolean;
  canOpenAgenda: boolean;
}) {
  const cargoSetor = [pessoa.cargo, pessoa.setor?.nome].filter(Boolean).join(" · ");

  const content = (
    <Card
      className={cn(
        "transition-colors",
        canOpenAgenda && "cursor-pointer hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <ProfileAvatar
          name={pessoa.nome_completo}
          avatarUrl={pessoa.avatar_url}
          className="h-12 w-12 shrink-0"
          fallbackClassName="text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{pessoa.nome_completo}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {cargoSetor || "Sem cargo/setor"}
          </p>
        </div>
        {showContador && (
          <Badge variant="secondary" className="shrink-0">
            {totalTarefas} {totalTarefas === 1 ? "tarefa" : "tarefas"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  if (!canOpenAgenda) return content;

  return (
    <Link
      to="/equipe/$pessoaId"
      params={{ pessoaId: pessoa.id }}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Ver agenda de ${pessoa.nome_completo}`}
    >
      {content}
    </Link>
  );
}

function EquipePage() {
  const navigate = useNavigate();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: pessoas, isLoading: loadingPessoas } = usePessoas();
  const { data: tarefas, isLoading: loadingTarefas } = useTarefas();
  const canManage = isAdminOrGerente(profile);

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((pessoa) => pessoa.ativo),
    [pessoas],
  );

  const gruposPorSetor = useMemo(() => {
    const grupos = new Map<string, SetorGrupo>();

    for (const pessoa of pessoasAtivas) {
      const setorId = pessoa.setor_id ?? "__sem_setor__";
      const setorNome = pessoa.setor?.nome ?? "Sem setor";
      const grupo = grupos.get(setorId) ?? { id: setorId, nome: setorNome, pessoas: [] };
      grupo.pessoas.push(pessoa);
      grupos.set(setorId, grupo);
    }

    return Array.from(grupos.values())
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((grupo) => ({
        ...grupo,
        pessoas: [...grupo.pessoas].sort((a, b) =>
          a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
        ),
      }));
  }, [pessoasAtivas]);

  if (!loadingProfile && profile && !canManage) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A visão de agendas da equipe é restrita a Administrador e Gestor.
          </p>
        </div>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Você não tem permissão para acessar esta área.
          <div className="mt-4">
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => navigate({ to: "/tarefas" })}
            >
              Ir para minha Agenda
            </button>
          </div>
        </div>
      </div>
    );
  }

  const loading = loadingProfile || loadingPessoas || (canManage && loadingTarefas);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Colaboradores agrupados por setor. Clique no card para abrir a agenda da pessoa.
        </p>
      </div>

      {loading ? (
        <div className={CARD_GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !pessoasAtivas.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhuma pessoa encontrada.
        </div>
      ) : (
        <div className="space-y-8">
          {gruposPorSetor.map((grupo) => (
            <section key={grupo.id} className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">{grupo.nome}</h2>
              <div className={CARD_GRID_CLASS}>
                {grupo.pessoas.map((pessoa) => (
                  <EquipePessoaCard
                    key={pessoa.id}
                    pessoa={pessoa}
                    totalTarefas={countTarefasDaPessoa(pessoa.id, tarefas)}
                    showContador={canManage}
                    canOpenAgenda={canManage}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
