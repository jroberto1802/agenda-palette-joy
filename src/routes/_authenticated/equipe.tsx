import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { TarefaDetailSheet } from "@/components/tarefas/tarefa-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePessoas } from "@/hooks/use-pessoas";
import { useTarefas } from "@/hooks/use-tarefas";
import type { ProfileWithSetor, TarefaWithRelations } from "@/types";
import { formatDate } from "@/utils/formatters";
import { TAREFA_STATUS_LABELS } from "@/utils/tarefas";
import { CARD_GRID_CLASS } from "@/lib/layout";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — CoreGestor" },
      { name: "description", content: "Visão por pessoa das atividades visíveis da equipe." },
    ],
  }),
  component: EquipePage,
});

type SetorGrupo = {
  id: string;
  nome: string;
  pessoas: ProfileWithSetor[];
};

function EquipePessoaCard({
  pessoa,
  tarefasDaPessoa,
  onSelectTask,
}: {
  pessoa: ProfileWithSetor;
  tarefasDaPessoa: TarefaWithRelations[];
  onSelectTask: (taskId: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <ProfileAvatar
            name={pessoa.nome_completo}
            avatarUrl={pessoa.avatar_url}
            className="h-14 w-14"
            fallbackClassName="text-base"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{pessoa.nome_completo}</p>
            <p className="truncate text-sm text-muted-foreground">
              {pessoa.setor?.nome ?? "Sem setor"}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Atividades</p>
          <Badge variant="outline">
            {tarefasDaPessoa.length} {tarefasDaPessoa.length === 1 ? "tarefa" : "tarefas"}
          </Badge>
        </div>

        {!tarefasDaPessoa.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade visível para esta pessoa.
          </p>
        ) : (
          <div className="space-y-2">
            {tarefasDaPessoa.slice(0, 6).map((tarefa) => (
              <button
                key={tarefa.id}
                type="button"
                onClick={() => onSelectTask(tarefa.id)}
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-medium">{tarefa.titulo}</p>
                  <Badge variant="secondary" className="shrink-0">
                    {TAREFA_STATUS_LABELS[tarefa.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tarefa.data_vencimento
                    ? `Vencimento: ${formatDate(tarefa.data_vencimento)}`
                    : "Sem data"}
                </p>
              </button>
            ))}
            {tarefasDaPessoa.length > 6 && (
              <p className="text-xs text-muted-foreground">
                +{tarefasDaPessoa.length - 6} atividades não exibidas neste card.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EquipePage() {
  const { data: pessoas, isLoading: loadingPessoas } = usePessoas();
  const { data: tarefas, isLoading: loadingTarefas } = useTarefas();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tarefasPorPessoa = useMemo(() => {
    const map = new Map<string, TarefaWithRelations[]>();
    for (const tarefa of tarefas ?? []) {
      if (!tarefa.atribuido_a) continue;
      const current = map.get(tarefa.atribuido_a) ?? [];
      current.push(tarefa);
      map.set(tarefa.atribuido_a, current);
    }
    return map;
  }, [tarefas]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cards por pessoa com as tarefas visíveis para o seu perfil atual.
        </p>
      </div>

      {loadingPessoas || loadingTarefas ? (
        <div className={CARD_GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
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
                    tarefasDaPessoa={tarefasPorPessoa.get(pessoa.id) ?? []}
                    onSelectTask={setSelectedTaskId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <TarefaDetailSheet
        tarefaId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
