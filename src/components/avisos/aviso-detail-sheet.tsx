import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, MessageSquare, Paperclip, Pin, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { useAvisoDetail, useCreateAvisoComentario, useSetAvisoLido } from "@/hooks/use-avisos";
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
  canDelete,
  onDelete,
  highlightComentarioId = null,
}: {
  avisoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  canDelete?: boolean;
  onDelete?: () => void;
  highlightComentarioId?: string | null;
}) {
  const { data: aviso, isLoading } = useAvisoDetail(avisoId);
  const createComentario = useCreateAvisoComentario();
  const setAvisoLido = useSetAvisoLido();
  const [comentario, setComentario] = useState("");
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

  const handleComentar = async () => {
    if (!avisoId || !comentario.trim() || readOnly) return;
    try {
      await createComentario.mutateAsync({ avisoId, conteudo: comentario.trim() });
      setComentario("");
    } catch (error) {
      toast.error("Erro ao comentar", { description: getSupabaseErrorMessage(error as Error) });
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                      <div className="space-y-4 p-4">
                        {!aviso.comentarios_permitidos ? (
                          <p className="text-sm text-muted-foreground">
                            Comentários desabilitados neste aviso.
                          </p>
                        ) : (
                          <>
                            <div className="space-y-4">
                              {comentarios.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum comentário ainda.
                                </p>
                              )}
                              {comentarios.map((c) => (
                                <div
                                  key={c.id}
                                  id={`aviso-comentario-${c.id}`}
                                  className={cn(
                                    "flex gap-3 rounded-lg p-2 transition-colors",
                                    highlightComentarioId === c.id && "bg-primary/10 ring-1 ring-primary/40",
                                  )}
                                >
                                  <ProfileAvatar
                                    name={c.usuario?.nome_completo ?? "?"}
                                    avatarUrl={c.usuario?.avatar_url}
                                    className="h-8 w-8 shrink-0"
                                  />
                                  <div>
                                    <p className="text-sm font-medium">{c.usuario?.nome_completo}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", {
                                        locale: ptBR,
                                      })}
                                    </p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                                      {c.conteudo}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {!readOnly && (
                              <div className="space-y-2 border-t pt-3">
                                <Textarea
                                  placeholder="Escreva um comentário..."
                                  rows={3}
                                  value={comentario}
                                  onChange={(e) => setComentario(e.target.value)}
                                />
                                <Button
                                  size="sm"
                                  onClick={handleComentar}
                                  disabled={!comentario.trim() || createComentario.isPending}
                                >
                                  Comentar
                                </Button>
                              </div>
                            )}
                          </>
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
