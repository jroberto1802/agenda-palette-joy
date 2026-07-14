import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { anexoKeys, subtarefaKeys, tarefaKeys } from "@/lib/query-keys";
import {
  deleteAnexo,
  deleteSubtarefaAnexo,
  listAnexos,
  listSubtarefaAnexos,
  uploadAnexo,
  uploadSubtarefaAnexo,
} from "@/services/anexos";
import type { SubtarefaAnexo, TarefaAnexo } from "@/types";

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

export function useSubtarefaAnexos(subtarefaId: string | null) {
  return useQuery({
    queryKey: anexoKeys.subtarefa(subtarefaId ?? ""),
    queryFn: () => listSubtarefaAnexos(subtarefaId!),
    enabled: !!subtarefaId,
  });
}

export function useUploadSubtarefaAnexo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subtarefaId, file }: { subtarefaId: string; file: File }) =>
      uploadSubtarefaAnexo(subtarefaId, file),
    onSuccess: (_data, { subtarefaId }) => {
      queryClient.invalidateQueries({ queryKey: anexoKeys.subtarefa(subtarefaId) });
      queryClient.invalidateQueries({ queryKey: subtarefaKeys.detail(subtarefaId) });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
    },
  });
}

export function useDeleteSubtarefaAnexo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (anexo: SubtarefaAnexo) => deleteSubtarefaAnexo(anexo),
    onSuccess: (_data, anexo) => {
      queryClient.invalidateQueries({ queryKey: anexoKeys.subtarefa(anexo.subtarefa_id) });
      queryClient.invalidateQueries({ queryKey: subtarefaKeys.detail(anexo.subtarefa_id) });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
    },
  });
}
