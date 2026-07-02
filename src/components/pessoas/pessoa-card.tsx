import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileWithSetor } from "@/types";
import { PAPEL_LABELS } from "@/utils/permissions";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function PessoaCard({
  pessoa,
  canEdit,
  onEdit,
}: {
  pessoa: ProfileWithSetor;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <Card className={!pessoa.ativo ? "opacity-60" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar>
              <AvatarImage src={pessoa.avatar_url ?? undefined} alt={pessoa.nome_completo} />
              <AvatarFallback>{initials(pessoa.nome_completo)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{pessoa.nome_completo}</CardTitle>
              <p className="text-sm text-muted-foreground truncate">
                {pessoa.cargo || "Sem cargo definido"}
              </p>
            </div>
          </div>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar pessoa">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{PAPEL_LABELS[pessoa.papel]}</Badge>
        {pessoa.setor ? (
          <Badge
            variant="outline"
            style={{
              borderColor: pessoa.setor.cor ?? undefined,
              color: pessoa.setor.cor ?? undefined,
            }}
          >
            {pessoa.setor.nome}
          </Badge>
        ) : (
          <Badge variant="outline">Sem setor</Badge>
        )}
        {!pessoa.ativo && <Badge variant="destructive">Inativo</Badge>}
      </CardContent>
    </Card>
  );
}
