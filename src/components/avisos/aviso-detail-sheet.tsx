import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, MessageSquare, Paperclip, Pencil, Pin, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CommentsThread } from "@/components/common/comments-thread";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { AvisoDestinatarioDisplay } from "@/components/avisos/aviso-destinatario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAvisoDetail, useCreateAvisoComentario, useSetAvisoLido } from "@/hooks/use-avisos";
import { usePessoas } from "@/hooks/use-pessoas";
import { LARGE_MODAL_CONTENT_CLASS } from "@/lib/layout";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { isAvisoLido } from "@/services/avisos";
import { cn } from "@/lib/utils";
import {
  AVISO_PRIORIDADE_BADGE_CLASS,
  AVISO_PRIORIDADE_BAND_CLASS,
  AVISO_PRIORIDADE_LABELS,
  formatAvisoExpiracao,
  isAvisoFinalizado,
} from "@/utils/avisos";

export function AvisoDetailSheet({
  avisoId,
  open,
  onOpenChange,
  userId,
  canEdit,
  onEdit,
  canDelete,
  onDelete,
  highlightComentarioId = null,
}: {
  avisoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  canEdit?: boolean;
  onEdit?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  highlightComentarioId?: string | null;
}) {
  const { data: aviso, isLoading } = useAvisoDetail(avisoId);
  const { data: pessoas } = usePessoas();
  const createComentario = useCreateAvisoComentario();
  const setAvisoLido = useSetAvisoLido();
  const [sideTab, setSideTab] = useState("comentarios");

  useEffect(() => {
    if (open && highlightComentarioId) setSideTab("comentarios");
  }, [open, highlightComentarioId]);

  useEffect(() => {
    if (!open || !highlightComentarioId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`aviso-comentario-${highlightComentarioId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, highlightComentarioId, aviso?.comentarios]);

  const lido = aviso ? isAvisoLido(aviso, userId) : false;
  const finalizado = aviso ? isAvisoFinalizado(aviso) : false;
  const readOnly = finalizado;
  const comentarios = aviso?.comentarios ?? [];

  const pessoasMencionaveis = useMemo(() => {
    const ativos = (pessoas ?? []).filter((p) => p.ativo);
    if (!aviso) return [];

    if (aviso.alcance === "todos") return ativos;

    const ids = new Set<string>();
    if (aviso.criado_por) ids.add(aviso.criado_por);

    if (aviso.alcance === "por_setor") {
      const setorIds = new Set(
        (aviso.setores ?? []).map((s) => s.setor?.id).filter((id): id is string => !!id),
      );
      for (const p of ativos) {
        if (p.setor_id && setorIds.has(p.setor_id)) ids.add(p.id);
      }
    } else {
      for (const row of aviso.pessoas ?? []) {
        if (row.usuario?.id) ids.add(row.usuario.id);
      }
    }

    for (const c of comentarios) {
      if (c.usuario_id) ids.add(c.usuario_id);
    }

    return ativos.filter((p) => ids.has(p.id));
  }, [aviso, pessoas, comentarios]);

  const handleToggleLido = async () => {
    if (!avisoId) return;
    try {
      await setAvisoLido.mutateAsync({ avisoId, lido: !lido });
    } catch (error) {
      toast.error("Erro ao atualizar leitura", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          LARGE_MODAL_CONTENT_CLASS,
          "border-l-4",
          aviso ? AVISO_PRIORIDADE_BAND_CLASS[aviso.prioridade] : "border-l-transparent",
        )}
      >
        {isLoading || !aviso ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 space-y-0 border-b p-6 pb-4 pr-12 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {aviso.fixado && <Pin className="h-4 w-4 text-amber-500" />}
                    <Badge
                      variant="outline"
                      className={cn("text-xs", AVISO_PRIORIDADE_BADGE_CLASS[aviso.prioridade])}
                    >
                      {AVISO_PRIORIDADE_LABELS[aviso.prioridade]}
                    </Badge>
                    {finalizado && <Badge variant="secondary">Finalizado</Badge>}
                  </div>
                  <DialogTitle className="text-left">{aviso.titulo}</DialogTitle>
                  <DialogDescription asChild>
                    <div className="mt-3 space-y-3 text-left">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar
                          name={aviso.criador?.nome_completo ?? "Sistema"}
                          avatarUrl={aviso.criador?.avatar_url}
                          className="h-8 w-8"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {aviso.criador?.nome_completo ?? "Sistema"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(aviso.data_publicacao), "dd 'de' MMMM 'de' yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>
                      <AvisoDestinatarioDisplay aviso={aviso} />
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatAvisoExpiracao(aviso.data_expiracao)}
                      </p>
                    </div>
                  </DialogDescription>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleToggleLido}
                    disabled={setAvisoLido.isPending}
                  >
                    {lido ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Lido
                      </>
                    ) : (
                      <>
                        <Circle className="h-4 w-4" />
                        Não lido
                      </>
                    )}
                  </Button>
                  {canEdit && onEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={onEdit}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  )}
                  {canDelete && onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir aviso
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-6">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{aviso.conteudo}</p>
                </div>
              </ScrollArea>

              <aside className="flex w-full shrink-0 flex-col border-t bg-muted/20 lg:w-96 lg:border-l lg:border-t-0">
                <Tabs value={sideTab} onValueChange={setSideTab} className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
                    <TabsTrigger value="anexos" className="gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" />
                      Anexos
                    </TabsTrigger>
                    <TabsTrigger value="comentarios" className="gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Comentários
                      {comentarios.length > 0 && (
                        <span className="text-muted-foreground">({comentarios.length})</span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="anexos"
                    className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
                  >
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Anexos ainda não estão disponíveis para avisos.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="comentarios"
                    className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
                  >
                    <ScrollArea className="h-full max-h-[calc(90vh-12rem)]">
                      <div className="p-4">
                        {!aviso.comentarios_permitidos ? (
                          <p className="text-sm text-muted-foreground">
                            Comentários desabilitados neste aviso.
                          </p>
                        ) : (
                          <CommentsThread
                            comentarios={comentarios}
                            pessoasMencionaveis={pessoasMencionaveis}
                            currentUserId={userId}
                            canComment={!readOnly}
                            canDeleteOwn={false}
                            highlightId={highlightComentarioId}
                            idPrefix="aviso-comentario"
                            pending={createComentario.isPending}
                            onSubmit={async (conteudo, parentId) => {
                              try {
                                await createComentario.mutateAsync({
                                  avisoId: avisoId!,
                                  conteudo,
                                  parentId,
                                });
                              } catch (error) {
                                toast.error("Erro ao comentar", {
                                  description: getSupabaseErrorMessage(error as Error),
                                });
                                throw error;
                              }
                            }}
                          />
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
