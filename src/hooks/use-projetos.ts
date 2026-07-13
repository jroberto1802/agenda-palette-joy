import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projetoKeys, tarefaKeys } from "@/lib/query-keys";
import {
  addProjetoMembro,
  createProjeto,
  deleteProjeto,
  getProjeto,
  listProjetoMembros,
  listProjetos,
  removeProjetoMembro,
  updateProjeto,
} from "@/services/projetos";
import type { ProjetoFormData } from "@/types";

export function useProjetos(search?: string) {
  return useQuery({
    queryKey: projetoKeys.list(search),
    queryFn: () => listProjetos(search),
  });
}

export function useProjeto(id: string | undefined) {
  return useQuery({
    queryKey: projetoKeys.detail(id ?? ""),
    queryFn: () => getProjeto(id!),
    enabled: !!id,
  });
}

export function useProjetoMembros(projetoId: string | undefined) {
  return useQuery({
    queryKey: [...projetoKeys.detail(projetoId ?? ""), "membros"] as const,
    queryFn: () => listProjetoMembros(projetoId!),
    enabled: !!projetoId,
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

export function useAddProjetoMembro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projetoId, usuarioId }: { projetoId: string; usuarioId: string }) =>
      addProjetoMembro(projetoId, usuarioId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: projetoKeys.all });
      queryClient.invalidateQueries({ queryKey: projetoKeys.detail(vars.projetoId) });
    },
  });
}

export function useRemoveProjetoMembro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projetoId, usuarioId }: { projetoId: string; usuarioId: string }) =>
      removeProjetoMembro(projetoId, usuarioId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: projetoKeys.all });
      queryClient.invalidateQueries({ queryKey: projetoKeys.detail(vars.projetoId) });
    },
  });
}
