import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, MessageSquare, Pin, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { AvisoDestinatarioDisplay } from "@/components/avisos/aviso-destinatario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAvisoDetail, useCreateAvisoComentario, useSetAvisoLido } from "@/hooks/use-avisos";
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
}: {
  avisoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const { data: aviso, isLoading } = useAvisoDetail(avisoId);
  const createComentario = useCreateAvisoComentario();
  const setAvisoLido = useSetAvisoLido();
  const [comentario, setComentario] = useState("");

  const lido = aviso ? isAvisoLido(aviso, userId) : false;
  const finalizado = aviso ? isAvisoFinalizado(aviso) : false;
  const readOnly = finalizado;

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "flex w-full flex-col border-l-4 p-0 sm:max-w-lg",
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
            <SheetHeader className="border-b p-6 pb-4">
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
              <SheetTitle className="text-left">{aviso.titulo}</SheetTitle>
              <SheetDescription asChild>
                <div className="space-y-3 text-left">
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
              </SheetDescription>

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
            </SheetHeader>

            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{aviso.conteudo}</p>

                {aviso.comentarios_permitidos && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <MessageSquare className="h-4 w-4" />
                        Comentários ({aviso.comentarios?.length ?? 0})
                      </h3>
                      <div className="space-y-4">
                        {(aviso.comentarios ?? []).map((c) => (
                          <div key={c.id} className="flex gap-3">
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
                        <div className="mt-4 space-y-2">
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
                    </section>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
