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

export function AvisoCard({
  aviso,
  lido,
  onOpen,
}: {
  aviso: AvisoWithRelations;
  lido: boolean;
  onOpen: () => void;
}) {
  const preview =
    aviso.conteudo.length > 120 ? `${aviso.conteudo.slice(0, 120)}...` : aviso.conteudo;

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden border-l-4 transition-colors hover:border-primary/40",
        AVISO_PRIORIDADE_BAND_CLASS[aviso.prioridade],
        !lido && "border-primary/30 bg-primary/5",
        aviso.fixado && "ring-1 ring-amber-500/30",
      )}
      onClick={onOpen}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {aviso.fixado && <Pin className="h-4 w-4 shrink-0 text-amber-500" />}
            <Badge
              variant="outline"
              className={cn("shrink-0 text-xs", AVISO_PRIORIDADE_BADGE_CLASS[aviso.prioridade])}
            >
              {AVISO_PRIORIDADE_LABELS[aviso.prioridade]}
            </Badge>
            <CardTitle className="truncate text-base">{aviso.titulo}</CardTitle>
          </div>
          {lido ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-label="Lido" />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Não lido" />
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ProfileAvatar
            name={aviso.criador?.nome_completo ?? "Sistema"}
            avatarUrl={aviso.criador?.avatar_url}
            className="h-7 w-7"
            fallbackClassName="text-[10px]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {aviso.criador?.nome_completo ?? "Sistema"}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(aviso.data_publicacao), "dd MMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <AvisoDestinatarioDisplay aviso={aviso} compact />
        <p className="line-clamp-2 text-sm text-muted-foreground">{preview}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {formatAvisoExpiracao(aviso.data_expiracao)}
        </p>
      </CardContent>
    </Card>
  );
}

export function AvisoEmptyState({ message = "Nenhum aviso publicado ainda." }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
