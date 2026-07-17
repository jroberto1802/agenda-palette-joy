import { useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  FolderKanban,
  ListTodo,
  Megaphone,
  MessageSquare,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuscaConteudo } from "@/hooks/use-busca";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  countBuscaResultados,
  type BuscaAvisoResult,
  type BuscaComentarioResult,
  type BuscaProjetoResult,
  type BuscaResultados,
  type BuscaSubtarefaResult,
  type BuscaTarefaResult,
} from "@/services/busca";

export function BuscaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");
  const { data, isFetching, isError, error, enabled, termoDebounced } = useBuscaConteudo(termo);

  useEffect(() => {
    if (!open) setTermo("");
  }, [open]);

  const resultados = data ?? emptyResultados();
  const total = countBuscaResultados(resultados);
  const showEmpty = enabled && !isFetching && !isError && total === 0;

  const goTo = (navigateFn: () => void) => {
    onOpenChange(false);
    navigateFn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="space-y-3 border-b px-5 pb-4 pt-5 text-left">
          <DialogTitle>Buscar</DialogTitle>
          <DialogDescription>
            Localize projetos, tarefas, subtarefas, avisos e comentários.
          </DialogDescription>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Digite uma palavra-chave ou frase..."
              className="h-11 pl-9 text-base"
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[min(55vh,28rem)] px-5 py-4">
          {!enabled && (
            <p className="text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para iniciar a busca.
            </p>
          )}

          {enabled && isFetching && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Erro ao buscar: {getSupabaseErrorMessage(error as Error)}
            </div>
          )}

          {showEmpty && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum resultado para &quot;{termoDebounced}&quot;.
              </p>
            </div>
          )}

          {enabled && !isFetching && !isError && total > 0 && (
            <div className="space-y-5 pb-2">
              <ResultGroup
                title="Projetos"
                icon={FolderKanban}
                count={resultados.projetos.length}
              >
                {resultados.projetos.map((item) => (
                  <ResultButton
                    key={item.id}
                    title={item.nome}
                    onClick={() =>
                      goTo(() =>
                        navigate({
                          to: "/projetos/$projetoId",
                          params: { projetoId: item.id },
                        }),
                      )
                    }
                  />
                ))}
              </ResultGroup>

              <ResultGroup
                title="Tarefas"
                icon={ClipboardList}
                count={resultados.tarefas.length}
              >
                {resultados.tarefas.map((item) => (
                  <ResultButton
                    key={item.id}
                    title={item.titulo}
                    subtitle={item.trecho}
                    onClick={() =>
                      goTo(() =>
                        navigate({
                          to: "/tarefas",
                          search: { tarefaId: item.id },
                        }),
                      )
                    }
                  />
                ))}
              </ResultGroup>

              <ResultGroup
                title="Subtarefas"
                icon={ListTodo}
                count={resultados.subtarefas.length}
              >
                {resultados.subtarefas.map((item) => (
                  <ResultButton
                    key={item.id}
                    title={item.titulo}
                    subtitle={item.trecho}
                    onClick={() =>
                      goTo(() =>
                        navigate({
                          to: "/tarefas",
                          search: {
                            tarefaId: item.tarefa_id,
                            subtarefaId: item.id,
                          },
                        }),
                      )
                    }
                  />
                ))}
              </ResultGroup>

              <ResultGroup title="Avisos" icon={Megaphone} count={resultados.avisos.length}>
                {resultados.avisos.map((item) => (
                  <ResultButton
                    key={item.id}
                    title={item.titulo}
                    subtitle={item.trecho}
                    onClick={() =>
                      goTo(() =>
                        navigate({
                          to: "/avisos",
                          search: { avisoId: item.id },
                        }),
                      )
                    }
                  />
                ))}
              </ResultGroup>

              <ResultGroup
                title="Comentários"
                icon={MessageSquare}
                count={resultados.comentarios.length}
              >
                {resultados.comentarios.map((item) => (
                  <ResultButton
                    key={`${item.origem}-${item.id}`}
                    title={item.contexto}
                    subtitle={item.trecho}
                    onClick={() =>
                      goTo(() =>
                        navigate({
                          to: "/tarefas",
                          search: {
                            tarefaId: item.tarefa_id,
                            aba: "comentarios",
                            comentarioId: item.id,
                            ...(item.origem === "subtarefa" && item.subtarefa_id
                              ? { subtarefaId: item.subtarefa_id }
                              : {}),
                          },
                        }),
                      )
                    }
                  />
                ))}
              </ResultGroup>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function emptyResultados(): BuscaResultados {
  return {
    projetos: [] as BuscaProjetoResult[],
    tarefas: [] as BuscaTarefaResult[],
    subtarefas: [] as BuscaSubtarefaResult[],
    avisos: [] as BuscaAvisoResult[],
    comentarios: [] as BuscaComentarioResult[],
  };
}

function ResultGroup({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {title}{" "}
          <span className="font-normal text-muted-foreground">({count})</span>
        </h2>
      </div>
      <div className="divide-y rounded-xl border bg-card">{children}</div>
    </section>
  );
}

function ResultButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  onClick: () => void;
}) {
  const preview = useMemo(() => {
    if (!subtitle?.trim()) return null;
    const clean = subtitle.replace(/\s+/g, " ").trim();
    return clean.length > 120 ? `${clean.slice(0, 120)}…` : clean;
  }, [subtitle]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="truncate text-sm font-medium">{title}</span>
      {preview && (
        <span className="line-clamp-2 text-xs text-muted-foreground">{preview}</span>
      )}
    </button>
  );
}
