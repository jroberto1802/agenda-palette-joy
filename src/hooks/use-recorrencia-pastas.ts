import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recorrenciaPastaKeys, tarefaKeys } from "@/lib/query-keys";
import {
  createRecorrenciaPasta,
  deleteRecorrenciaPasta,
  getRecorrenciaPasta,
  listRecorrenciaPastaMembros,
  listRecorrenciaPastas,
  moveSerieParaPasta,
  setRecorrenciaPastaMembros,
  updateRecorrenciaPasta,
  type RecorrenciaPastaFormData,
} from "@/services/recorrencia-pastas";

export function useRecorrenciaPastas(search?: string) {
  return useQuery({
    queryKey: [...recorrenciaPastaKeys.list(), search ?? ""] as const,
    queryFn: () => listRecorrenciaPastas(search),
  });
}

export function useRecorrenciaPasta(id: string | undefined) {
  return useQuery({
    queryKey: recorrenciaPastaKeys.detail(id ?? ""),
    queryFn: () => getRecorrenciaPasta(id!),
    enabled: !!id,
  });
}

export function useRecorrenciaPastaMembros(pastaId: string | undefined) {
  return useQuery({
    queryKey: recorrenciaPastaKeys.membros(pastaId ?? ""),
    queryFn: () => listRecorrenciaPastaMembros(pastaId!),
    enabled: !!pastaId && pastaId !== "entradas",
  });
}

function invalidatePastas(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: recorrenciaPastaKeys.all });
  void queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
}

export function useCreateRecorrenciaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecorrenciaPastaFormData) => createRecorrenciaPasta(data),
    onSuccess: () => invalidatePastas(queryClient),
  });
}

export function useUpdateRecorrenciaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecorrenciaPastaFormData }) =>
      updateRecorrenciaPasta(id, data),
    onSuccess: () => invalidatePastas(queryClient),
  });
}

/** @deprecated Preferir useUpdateRecorrenciaPasta */
export function useRenameRecorrenciaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      updateRecorrenciaPasta(id, {
        nome,
        responsavel_id: null,
        membro_ids: [],
      }),
    onSuccess: () => invalidatePastas(queryClient),
  });
}

export function useDeleteRecorrenciaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecorrenciaPasta(id),
    onSuccess: () => invalidatePastas(queryClient),
  });
}

export function useSetRecorrenciaPastaMembros() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pastaId,
      usuarioIds,
    }: {
      pastaId: string;
      usuarioIds: string[];
    }) => setRecorrenciaPastaMembros(pastaId, usuarioIds),
    onSuccess: () => invalidatePastas(queryClient),
  });
}

export function useMoveSerieParaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tarefaId,
      pastaId,
    }: {
      tarefaId: string;
      pastaId: string | null;
    }) => moveSerieParaPasta(tarefaId, pastaId),
    onSuccess: () => invalidatePastas(queryClient),
  });
}
