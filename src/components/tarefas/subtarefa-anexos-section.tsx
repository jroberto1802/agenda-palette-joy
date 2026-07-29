import { Download, FileIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  useDeleteSubtarefaAnexo,
  useUploadSubtarefaAnexo,
} from "@/hooks/use-anexos";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import { downloadAnexoFile } from "@/services/anexos";
import type { SubtarefaAnexo } from "@/types";
import { ANEXO_TAMANHO_EXCEDIDO_MSG } from "@/utils/anexos";
import { formatDateTime } from "@/utils/formatters";

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubtarefaAnexosSection({
  subtarefaId,
  anexos,
  canEdit,
  /** Upload liberado para visualizadores; se omitido, segue `canEdit`. */
  canUpload,
  hideTitle = false,
  compact = false,
}: {
  subtarefaId: string;
  anexos: SubtarefaAnexo[];
  canEdit: boolean;
  canUpload?: boolean;
  hideTitle?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAnexo = useUploadSubtarefaAnexo();
  const deleteAnexo = useDeleteSubtarefaAnexo();
  const [deleting, setDeleting] = useState<SubtarefaAnexo | null>(null);
  const allowUpload = canUpload ?? canEdit;

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await uploadAnexo.mutateAsync({ subtarefaId, file });
        toast.success(`"${file.name}" enviado`);
      } catch (error) {
        const message = getSupabaseErrorMessage(error as Error);
        if (message === ANEXO_TAMANHO_EXCEDIDO_MSG) {
          toast.error(ANEXO_TAMANHO_EXCEDIDO_MSG);
        } else {
          toast.error("Erro ao enviar anexo", { description: message });
        }
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDownload = async (anexo: SubtarefaAnexo) => {
    try {
      await downloadAnexoFile(anexo.storage_path, anexo.nome);
    } catch (error) {
      toast.error("Erro ao baixar anexo", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <section className="w-full min-w-0">
      <div
        className={cn(
          "flex items-center justify-between",
          compact ? "mb-2" : "mb-3",
          hideTitle && "mb-2",
        )}
      >
        {!hideTitle ? (
          <h3
            className={cn(
              "flex items-center gap-2 font-semibold",
              compact ? "text-xs" : "text-sm",
            )}
          >
            <Paperclip className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            Anexos ({anexos.length})
          </h3>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {anexos.length} arquivo(s)
          </span>
        )}
        {allowUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("gap-1.5", compact && "h-7 px-2 text-xs")}
              disabled={uploadAnexo.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Enviar
            </Button>
          </>
        )}
      </div>

      {anexos.length === 0 ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Nenhum anexo nesta subtarefa.
        </p>
      ) : (
        <div className={cn("w-full min-w-0", compact ? "space-y-1.5" : "space-y-2")}>
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 rounded-md border group",
                compact ? "px-2 py-1.5" : "px-3 py-2",
              )}
            >
              <FileIcon
                className={cn(
                  "shrink-0 text-muted-foreground",
                  compact ? "h-3.5 w-3.5" : "h-4 w-4",
                )}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className={cn(
                    "block w-full truncate text-left font-medium hover:underline",
                    compact ? "text-xs" : "text-sm",
                  )}
                  onClick={() => void handleDownload(anexo)}
                  title={`Baixar ${anexo.nome}`}
                >
                  {anexo.nome}
                </button>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(anexo.tamanho)} · {formatDateTime(anexo.created_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("shrink-0", compact ? "h-6 w-6" : "h-7 w-7")}
                onClick={() => void handleDownload(anexo)}
                title={`Baixar ${anexo.nome}`}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 text-destructive hover:text-destructive",
                    compact ? "h-6 w-6" : "h-7 w-7",
                  )}
                  onClick={() => setDeleting(anexo)}
                  title={`Excluir ${anexo.nome}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        itemKind="anexo"
        itemName={deleting?.nome}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteAnexo.mutateAsync(deleting);
            toast.success("Anexo removido");
          } catch (error) {
            toast.error(getSupabaseErrorMessage(error as Error));
            throw error;
          }
        }}
      />
    </section>
  );
}
