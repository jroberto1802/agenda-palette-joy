import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recorrenciaPastaKeys, tarefaKeys } from "@/lib/query-keys";
import {
  createRecorrenciaPasta,
  deleteRecorrenciaPasta,
  listRecorrenciaPastas,
  moveSerieParaPasta,
  renameRecorrenciaPasta,
  setRecorrenciaPastaMembros,
} from "@/services/recorrencia-pastas";

export function useRecorrenciaPastas() {
  return useQuery({
    queryKey: recorrenciaPastaKeys.list(),
    queryFn: () => listRecorrenciaPastas(),
  });
}

function invalidatePastas(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: recorrenciaPastaKeys.all });
  void queryClient.invalidateQueries({ queryKey: tarefaKeys.seriesModelos() });
}

export function useCreateRecorrenciaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => createRecorrenciaPasta(nome),
    onSuccess: () => invalidatePastas(queryClient),
  });
}

export function useRenameRecorrenciaPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      renameRecorrenciaPasta(id, nome),
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
