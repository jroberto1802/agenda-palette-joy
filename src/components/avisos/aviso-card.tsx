import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Megaphone, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvisoWithRelations } from "@/types";
import { AVISO_ALCANCE_LABELS } from "@/utils/avisos";
import { cn } from "@/lib/utils";

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
        "cursor-pointer hover:border-primary/40 transition-colors",
        !lido && "border-primary/30 bg-primary/5",
        aviso.fixado && "ring-1 ring-amber-500/30",
      )}
      onClick={onOpen}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {aviso.fixado && <Pin className="h-4 w-4 text-amber-500 shrink-0" />}
            <CardTitle className="text-base truncate">{aviso.titulo}</CardTitle>
          </div>
          {!lido && (
            <Badge variant="default" className="shrink-0 text-xs">
              Novo
            </Badge>
          )}
        </div>
        <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
          <span>{aviso.criador?.nome_completo ?? "Sistema"}</span>
          <span>·</span>
          <span>
            {format(new Date(aviso.data_publicacao), "dd MMM yyyy", { locale: ptBR })}
          </span>
          <Badge variant="outline" className="text-xs">
            {AVISO_ALCANCE_LABELS[aviso.alcance]}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>
        {aviso.alcance === "por_setor" && aviso.setores.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {aviso.setores.map((s) =>
              s.setor ? (
                <Badge key={s.setor.id} variant="secondary" className="text-xs">
                  {s.setor.nome}
                </Badge>
              ) : null,
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AvisoEmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground">Nenhum aviso publicado ainda.</p>
    </div>
  );
}
