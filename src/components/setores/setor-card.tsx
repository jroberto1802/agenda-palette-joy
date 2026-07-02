import { Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SetorWithGerente } from "@/types";

export function SetorCard({
  setor,
  pessoasCount,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  setor: SetorWithGerente;
  pessoasCount: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: setor.cor ?? "#94a3b8" }}
            />
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{setor.nome}</CardTitle>
              {setor.descricao && (
                <CardDescription className="line-clamp-2 mt-1">{setor.descricao}</CardDescription>
              )}
            </div>
          </div>
          {(canEdit || canDelete) && (
            <div className="flex shrink-0 gap-1">
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar setor">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  aria-label="Excluir setor"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1">
        <p>
          Gerente:{" "}
          <span className="text-foreground">{setor.gerente?.nome_completo ?? "Não definido"}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {pessoasCount} {pessoasCount === 1 ? "pessoa" : "pessoas"}
        </p>
      </CardContent>
    </Card>
  );
}
