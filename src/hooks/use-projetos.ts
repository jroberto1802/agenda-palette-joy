import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projetoKeys, tarefaKeys } from "@/lib/query-keys";
import {
  createProjeto,
  deleteProjeto,
  listProjetos,
  updateProjeto,
} from "@/services/projetos";
import type { ProjetoFormData } from "@/types";

export function useProjetos(search?: string) {
  return useQuery({
    queryKey: projetoKeys.list(search),
    queryFn: () => listProjetos(search),
  });
}

export function useCreateProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjetoFormData) => createProjeto(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projetoKeys.all });
    },
  });
}

export function useUpdateProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjetoFormData }) =>
      updateProjeto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projetoKeys.all });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
    },
  });
}

export function useDeleteProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjeto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projetoKeys.all });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
    },
  });
}
