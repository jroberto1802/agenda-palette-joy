import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, Megaphone, Pin } from "lucide-react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { AvisoDestinatarioDisplay } from "@/components/avisos/aviso-destinatario";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AvisoWithRelations } from "@/types";
import {
  AVISO_PRIORIDADE_BADGE_CLASS,
  AVISO_PRIORIDADE_BAND_CLASS,
  AVISO_PRIORIDADE_LABELS,
  formatAvisoExpiracao,
} from "@/utils/avisos";
import { stripHtml } from "@/utils/rich-text";

export function AvisoCard({
  aviso,
  lido,
  onOpen,
  muted = false,
}: {
  aviso: AvisoWithRelations;
  lido: boolean;
  onOpen: () => void;
  /** Histórico (aba Finalizados): baixo contraste, só consulta. */
  muted?: boolean;
}) {
  const plain = stripHtml(aviso.conteudo);
  const preview = plain.length > 80 ? `${plain.slice(0, 80)}...` : plain;

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden border-l-4 transition-colors",
        muted
          ? "border-l-muted-foreground/40 bg-muted/30 text-muted-foreground opacity-80 grayscale hover:border-muted-foreground/50 hover:bg-muted/40"
          : cn(
              AVISO_PRIORIDADE_BAND_CLASS[aviso.prioridade],
              "hover:border-primary/40",
              !lido && "border-primary/30 bg-primary/5",
              aviso.fixado && "ring-1 ring-amber-500/30",
            ),
      )}
      onClick={onOpen}
    >
      <CardHeader className="space-y-1.5 p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {aviso.fixado && (
              <Pin
                className={cn(
                  "h-3 w-3 shrink-0",
                  muted ? "text-muted-foreground" : "text-amber-500",
                )}
              />
            )}
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 px-1.5 py-0 text-[10px]",
                muted
                  ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                  : AVISO_PRIORIDADE_BADGE_CLASS[aviso.prioridade],
              )}
            >
              {AVISO_PRIORIDADE_LABELS[aviso.prioridade]}
            </Badge>
          </div>
          {lido ? (
            <CheckCircle2
              className={cn(
                "h-3 w-3 shrink-0",
                muted ? "text-muted-foreground" : "text-green-600",
              )}
              aria-label="Lido"
            />
          ) : (
            <Circle
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label="Não lido"
            />
          )}
        </div>

        <CardTitle
          className={cn(
            "line-clamp-2 text-sm font-semibold leading-snug",
            muted && "text-muted-foreground",
          )}
        >
          {aviso.titulo}
        </CardTitle>

        <div className="flex items-center gap-1.5">
          <ProfileAvatar
            name={aviso.criador?.nome_completo ?? "Sistema"}
            avatarUrl={aviso.criador?.avatar_url}
            className={cn("h-4 w-4", muted && "opacity-70")}
            fallbackClassName="text-[8px]"
          />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-xs font-medium leading-tight",
                muted && "text-muted-foreground",
              )}
            >
              {aviso.criador?.nome_completo ?? "Sistema"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(aviso.data_publicacao), "dd MMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-3 pt-0">
        <AvisoDestinatarioDisplay aviso={aviso} compact />
        <p className="line-clamp-1 text-xs leading-snug text-muted-foreground">{preview}</p>
        <p className="text-[10px] font-medium text-muted-foreground">
          {formatAvisoExpiracao(aviso.data_expiracao)}
        </p>
      </CardContent>
    </Card>
  );
}

export function AvisoEmptyState({
  message = "Nenhum aviso publicado ainda.",
  muted = false,
}: {
  message?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed p-12 text-center",
        muted && "border-muted-foreground/25 bg-muted/20",
      )}
    >
      <Megaphone
        className={cn(
          "mx-auto mb-3 h-10 w-10 text-muted-foreground",
          muted && "opacity-60",
        )}
      />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
