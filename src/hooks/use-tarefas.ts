import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tarefaKeys } from "@/lib/query-keys";
import {
  createSubtarefa,
  createTarefa,
  createTarefaComentario,
  deleteSubtarefa,
  deleteTarefaComentario,
  getDashboardKpis,
  getTarefaDetail,
  listRecentTarefas,
  listTarefas,
  listTarefasCalendario,
  softDeleteTarefa,
  toggleSubtarefa,
  updateSubtarefa,
  updateTarefa,
  updateTarefaStatus,
  type CreateSubtarefaParams,
  type UpdateSubtarefaParams,
} from "@/services/tarefas";
import type { TarefaFilters, TarefaFormData, TarefaStatus } from "@/types";

function invalidateTarefas(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
}

export function useTarefas(filters: TarefaFilters = {}) {
  const filterKey = {
    search: filters.search ?? "",
    status: filters.status ?? "all",
    prioridade: filters.prioridade ?? "all",
    setor_id: filters.setor_id ?? "all",
    projeto_id: filters.projeto_id ?? "all",
    atribuido_a: filters.atribuido_a ?? "all",
    atribuido_ids: [...(filters.atribuido_ids ?? [])].sort().join(","),
    tag: filters.tag ?? "",
  };

  return useQuery({
    queryKey: tarefaKeys.list(filterKey),
    queryFn: () => listTarefas(filters),
  });
}

export function useTarefaDetail(id: string | null) {
  return useQuery({
    queryKey: tarefaKeys.detail(id ?? ""),
    queryFn: () => getTarefaDetail(id!),
    enabled: !!id,
  });
}

export function useRecentTarefas(limit = 5) {
  return useQuery({
    queryKey: tarefaKeys.recent(),
    queryFn: () => listRecentTarefas(limit),
  });
}

export function useTarefasCalendario(mesInicio: string, mesFim: string) {
  return useQuery({
    queryKey: tarefaKeys.calendario(mesInicio),
    queryFn: () => listTarefasCalendario(mesInicio, mesFim),
  });
}

export function useDashboardKpis() {
  return useQuery({
    queryKey: tarefaKeys.kpis(),
    queryFn: getDashboardKpis,
  });
}

export function useCreateTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TarefaFormData) => createTarefa(data),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useUpdateTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TarefaFormData }) => updateTarefa(id, data),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useUpdateTarefaStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TarefaStatus }) =>
      updateTarefaStatus(id, status),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useSoftDeleteTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteTarefa(id),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useCreateSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateSubtarefaParams) => createSubtarefa(params),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useUpdateSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubtarefaParams }) =>
      updateSubtarefa(id, data),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useToggleSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      toggleSubtarefa(id, concluida),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useDeleteSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubtarefa(id),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useCreateTarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tarefaId, conteudo }: { tarefaId: string; conteudo: string }) =>
      createTarefaComentario(tarefaId, conteudo),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useDeleteTarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTarefaComentario(id),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}
