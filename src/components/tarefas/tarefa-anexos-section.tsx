import { Download, FileIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDeleteAnexo, useUploadAnexo } from "@/hooks/use-anexos";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import { getAnexoSignedUrl } from "@/services/anexos";
import type { TarefaAnexo } from "@/types";
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
  hideTitle = false,
}: {
  tarefaId: string;
  anexos: TarefaAnexo[];
  canEdit: boolean;
  hideTitle?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAnexo = useUploadAnexo();
  const deleteAnexo = useDeleteAnexo();

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await uploadAnexo.mutateAsync({ tarefaId, file });
        toast.success(`"${file.name}" enviado`);
      } catch (error) {
        toast.error("Erro ao enviar anexo", {
          description: getSupabaseErrorMessage(error as Error),
        });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDownload = async (anexo: TarefaAnexo) => {
    try {
      const url = await getAnexoSignedUrl(anexo.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
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
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
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
        <div className="space-y-2">
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 group"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{anexo.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(anexo.tamanho)} · {formatDateTime(anexo.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDownload(anexo)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={async () => {
                    try {
                      await deleteAnexo.mutateAsync(anexo);
                      toast.success("Anexo removido");
                    } catch (error) {
                      toast.error(getSupabaseErrorMessage(error as Error));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
