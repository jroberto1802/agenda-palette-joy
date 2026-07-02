import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Pin, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useAvisoDetail, useCreateAvisoComentario } from "@/hooks/use-avisos";
import { useProfile } from "@/hooks/use-profile";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { AVISO_ALCANCE_LABELS } from "@/utils/avisos";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function AvisoDetailSheet({
  avisoId,
  open,
  onOpenChange,
  canDelete,
  onDelete,
}: {
  avisoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const { data: profile } = useProfile();
  const { data: aviso, isLoading } = useAvisoDetail(avisoId);
  const createComentario = useCreateAvisoComentario();
  const [comentario, setComentario] = useState("");

  const handleComentar = async () => {
    if (!avisoId || !comentario.trim()) return;
    try {
      await createComentario.mutateAsync({ avisoId, conteudo: comentario.trim() });
      setComentario("");
    } catch (error) {
      toast.error("Erro ao comentar", { description: getSupabaseErrorMessage(error as Error) });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        {isLoading || !aviso ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 pb-4 border-b">
              <div className="flex items-center gap-2 mb-2">
                {aviso.fixado && <Pin className="h-4 w-4 text-amber-500" />}
                <Badge variant="outline">{AVISO_ALCANCE_LABELS[aviso.alcance]}</Badge>
              </div>
              <SheetTitle className="text-left">{aviso.titulo}</SheetTitle>
              <SheetDescription className="text-left">
                {aviso.criador?.nome_completo} ·{" "}
                {format(new Date(aviso.data_publicacao), "dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </SheetDescription>
              {canDelete && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit text-destructive hover:text-destructive gap-2"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir aviso
                </Button>
              )}
            </SheetHeader>

            <ScrollArea className="flex-1 px-6">
              <div className="py-4 space-y-6">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{aviso.conteudo}</p>

                {aviso.alcance === "por_setor" && aviso.setores.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {aviso.setores.map((s) =>
                      s.setor ? (
                        <Badge key={s.setor.id} variant="secondary">
                          {s.setor.nome}
                        </Badge>
                      ) : null,
                    )}
                  </div>
                )}

                {aviso.comentarios_permitidos && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4" />
                        Comentários ({aviso.comentarios?.length ?? 0})
                      </h3>
                      <div className="space-y-4">
                        {(aviso.comentarios ?? []).map((c) => (
                          <div key={c.id} className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={c.usuario?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {initials(c.usuario?.nome_completo ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{c.usuario?.nome_completo}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
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
