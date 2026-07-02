import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TarefaAnexosSection } from "@/components/tarefas/tarefa-anexos-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSubtarefa,
  useCreateTarefaComentario,
  useDeleteSubtarefa,
  useDeleteTarefaComentario,
  useTarefaDetail,
  useToggleSubtarefa,
} from "@/hooks/use-tarefas";
import { useProfile } from "@/hooks/use-profile";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { formatDateTime } from "@/utils/formatters";
import { isAdmin, isGerente } from "@/utils/permissions";
import {
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
  canEditTarefa,
} from "@/utils/tarefas";
import { formatRecorrencia, parseRecorrencia } from "@/utils/recorrencia";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function TarefaDetailSheet({
  tarefaId,
  open,
  onOpenChange,
  onEdit,
}: {
  tarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const { data: profile } = useProfile();
  const { data: tarefa, isLoading } = useTarefaDetail(tarefaId);
  const createSubtarefa = useCreateSubtarefa();
  const toggleSubtarefa = useToggleSubtarefa();
  const deleteSubtarefa = useDeleteSubtarefa();
  const createComentario = useCreateTarefaComentario();
  const deleteComentario = useDeleteTarefaComentario();

  const [novaSubtarefa, setNovaSubtarefa] = useState("");
  const [novoComentario, setNovoComentario] = useState("");

  const subtarefas = tarefa?.subtarefas ?? [];
  const comentarios = tarefa?.comentarios ?? [];
  const anexos = tarefa?.anexos ?? [];
  const concluidas = subtarefas.filter((s) => s.concluida).length;
  const recorrencia = tarefa ? parseRecorrencia(tarefa.recorrencia) : null;

  const handleAddSubtarefa = async () => {
    if (!tarefaId || !novaSubtarefa.trim()) return;
    try {
      await createSubtarefa.mutateAsync({ tarefaId, titulo: novaSubtarefa.trim() });
      setNovaSubtarefa("");
    } catch (error) {
      toast.error("Erro ao adicionar subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleAddComentario = async () => {
    if (!tarefaId || !novoComentario.trim()) return;
    try {
      await createComentario.mutateAsync({ tarefaId, conteudo: novoComentario.trim() });
      setNovoComentario("");
    } catch (error) {
      toast.error("Erro ao comentar", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        {isLoading || !tarefa ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 pb-4 border-b">
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[tarefa.prioridade]}>
                  {tarefa.prioridade}
                </Badge>
                <Badge variant="secondary" className={TAREFA_STATUS_COLORS[tarefa.status]}>
                  {TAREFA_STATUS_LABELS[tarefa.status]}
                </Badge>
                {tarefa.setor && (
                  <Badge variant="outline" style={{ borderColor: tarefa.setor.cor ?? undefined }}>
                    {tarefa.setor.nome}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-left">{tarefa.titulo}</SheetTitle>
              <SheetDescription className="text-left">
                {tarefa.descricao || "Sem descrição"}
              </SheetDescription>
              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                {tarefa.responsavel && <p>Responsável: {tarefa.responsavel.nome_completo}</p>}
                {tarefa.data_vencimento && <p>Vencimento: {formatDateTime(tarefa.data_vencimento)}</p>}
                {recorrencia && <p>Recorrência: {formatRecorrencia(recorrencia)}</p>}
                {tarefa.criador && <p>Criado por: {tarefa.criador.nome_completo}</p>}
              </div>
              {onEdit && (
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={onEdit}>
                  Editar tarefa
                </Button>
              )}
            </SheetHeader>

            <ScrollArea className="flex-1 px-6">
              <div className="py-4 space-y-6">
                {/* Subtarefas */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Subtarefas {subtarefas.length > 0 && `(${concluidas}/${subtarefas.length})`}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {subtarefas.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 group">
                        <Checkbox
                          checked={sub.concluida}
                          onCheckedChange={async (checked) => {
                            try {
                              await toggleSubtarefa.mutateAsync({
                                id: sub.id,
                                concluida: !!checked,
                              });
                            } catch (error) {
                              toast.error(getSupabaseErrorMessage(error as Error));
                            }
                          }}
                        />
                        <span
                          className={sub.concluida ? "line-through text-muted-foreground text-sm flex-1" : "text-sm flex-1"}
                        >
                          {sub.titulo}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={async () => {
                            try {
                              await deleteSubtarefa.mutateAsync(sub.id);
                            } catch (error) {
                              toast.error(getSupabaseErrorMessage(error as Error));
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Nova subtarefa..."
                      value={novaSubtarefa}
                      onChange={(e) => setNovaSubtarefa(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubtarefa()}
                    />
                    <Button size="icon" onClick={handleAddSubtarefa} disabled={!novaSubtarefa.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </section>

                <Separator />

                <TarefaAnexosSection
                  tarefaId={tarefa.id}
                  anexos={anexos}
                  canEdit={canEditTarefa(
                    tarefa,
                    profile?.id,
                    isAdmin(profile),
                    isGerente(profile),
                    profile?.setor_id,
                  )}
                />

                <Separator />

                {/* Comentários */}
                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4" />
                    Comentários ({comentarios.length})
                  </h3>
                  <div className="space-y-4">
                    {comentarios.map((c) => (
                      <div key={c.id} className="flex gap-3 group">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={c.usuario?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {initials(c.usuario?.nome_completo ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{c.usuario?.nome_completo}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
                            {c.usuario_id === profile?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100"
                                onClick={async () => {
                                  try {
                                    await deleteComentario.mutateAsync(c.id);
                                  } catch (error) {
                                    toast.error(getSupabaseErrorMessage(error as Error));
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {c.conteudo}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    <Textarea
                      placeholder="Escreva um comentário..."
                      rows={3}
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddComentario}
                      disabled={!novoComentario.trim() || createComentario.isPending}
                    >
                      Comentar
                    </Button>
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
