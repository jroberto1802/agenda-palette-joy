import { Download, FileIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteAnexo, useUploadAnexo } from "@/hooks/use-anexos";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import { downloadAnexoFile } from "@/services/anexos";
import type { TarefaAnexo } from "@/types";
import { ANEXO_TAMANHO_EXCEDIDO_MSG } from "@/utils/anexos";
import { formatDateTime } from "@/utils/formatters";

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TarefaAnexosSection({
  tarefaId,
  anexos,
  canEdit,
  /** Upload liberado para visualizadores; se omitido, segue `canEdit`. */
  canUpload,
  hideTitle = false,
}: {
  tarefaId: string;
  anexos: TarefaAnexo[];
  canEdit: boolean;
  canUpload?: boolean;
  hideTitle?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAnexo = useUploadAnexo();
  const deleteAnexo = useDeleteAnexo();
  const [deleting, setDeleting] = useState<TarefaAnexo | null>(null);
  const allowUpload = canUpload ?? canEdit;

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await uploadAnexo.mutateAsync({ tarefaId, file });
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

  const handleDownload = async (anexo: TarefaAnexo) => {
    try {
      await downloadAnexoFile(anexo.storage_path, anexo.nome);
    } catch (error) {
      toast.error("Erro ao baixar anexo", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <section>
      <div className={cn("mb-3 flex items-center justify-between", hideTitle && "mb-2")}>
        {!hideTitle ? (
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="h-4 w-4" />
            Anexos ({anexos.length})
          </h3>
        ) : (
          <span className="text-xs text-muted-foreground">{anexos.length} arquivo(s)</span>
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
              className="gap-2"
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
        <p className="text-sm text-muted-foreground">Nenhum anexo nesta tarefa.</p>
      ) : (
        <div className="w-full min-w-0 space-y-2">
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className="flex w-full min-w-0 items-center gap-2 rounded-md border px-3 py-2 group"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="block w-full truncate text-left text-sm font-medium hover:underline"
                  onClick={() => void handleDownload(anexo)}
                  title={`Baixar ${anexo.nome}`}
                >
                  {anexo.nome}
                </button>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(anexo.tamanho)} · {formatDateTime(anexo.created_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
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
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
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
