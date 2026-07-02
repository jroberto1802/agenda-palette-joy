import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { anexoKeys, tarefaKeys } from "@/lib/query-keys";
import { deleteAnexo, listAnexos, uploadAnexo } from "@/services/anexos";
import type { TarefaAnexo } from "@/types";

export function useAnexos(tarefaId: string | null) {
  return useQuery({
    queryKey: anexoKeys.list(tarefaId ?? ""),
    queryFn: () => listAnexos(tarefaId!),
    enabled: !!tarefaId,
  });
}

export function useUploadAnexo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tarefaId, file }: { tarefaId: string; file: File }) =>
      uploadAnexo(tarefaId, file),
    onSuccess: (_data, { tarefaId }) => {
      queryClient.invalidateQueries({ queryKey: anexoKeys.list(tarefaId) });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.detail(tarefaId) });
    },
  });
}

export function useDeleteAnexo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (anexo: TarefaAnexo) => deleteAnexo(anexo),
    onSuccess: (_data, anexo) => {
      queryClient.invalidateQueries({ queryKey: anexoKeys.list(anexo.tarefa_id) });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.detail(anexo.tarefa_id) });
    },
  });
}
