import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
import type { TarefaDetail, TarefaFilters, TarefaFormData, TarefaStatus } from "@/types";

/** Listas/KPIs/calendário — usar em create/update/delete de tarefa. */
function invalidateTarefaCollections(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [...tarefaKeys.all, "list"] });
  void queryClient.invalidateQueries({ queryKey: tarefaKeys.recent() });
  void queryClient.invalidateQueries({ queryKey: tarefaKeys.kpis() });
  void queryClient.invalidateQueries({
    queryKey: [...tarefaKeys.all, "calendario"],
  });
}

function invalidateTarefaDetail(queryClient: QueryClient, tarefaId: string) {
  void queryClient.invalidateQueries({ queryKey: tarefaKeys.detail(tarefaId) });
}

function setTarefaDetail(
  queryClient: QueryClient,
  tarefaId: string,
  updater: (old: TarefaDetail) => TarefaDetail,
) {
  queryClient.setQueryData<TarefaDetail>(tarefaKeys.detail(tarefaId), (old) =>
    old ? updater(old) : old,
  );
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
    onSuccess: (tarefa) => {
      invalidateTarefaCollections(queryClient);
      invalidateTarefaDetail(queryClient, tarefa.id);
    },
  });
}

export function useUpdateTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TarefaFormData }) => updateTarefa(id, data),
    onSuccess: (tarefa) => {
      invalidateTarefaCollections(queryClient);
      invalidateTarefaDetail(queryClient, tarefa.id);
    },
  });
}

export function useUpdateTarefaStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TarefaStatus }) =>
      updateTarefaStatus(id, status),
    onSuccess: (tarefa) => {
      invalidateTarefaCollections(queryClient);
      invalidateTarefaDetail(queryClient, tarefa.id);
    },
  });
}

export function useSoftDeleteTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteTarefa(id),
    onSuccess: (_void, id) => {
      invalidateTarefaCollections(queryClient);
      invalidateTarefaDetail(queryClient, id);
    },
  });
}

export function useCreateSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateSubtarefaParams) => createSubtarefa(params),
    onSuccess: (sub, params) => {
      setTarefaDetail(queryClient, params.tarefaId, (old) => ({
        ...old,
        subtarefas: [...(old.subtarefas ?? []), sub],
      }));
    },
  });
}

export function useUpdateSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubtarefaParams }) =>
      updateSubtarefa(id, data),
    onSuccess: (sub) => {
      setTarefaDetail(queryClient, sub.tarefa_id, (old) => ({
        ...old,
        subtarefas: (old.subtarefas ?? []).map((s) => (s.id === sub.id ? sub : s)),
      }));
    },
  });
}

export function useToggleSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      toggleSubtarefa(id, concluida),
    onMutate: async ({ id, concluida }) => {
      await queryClient.cancelQueries({ queryKey: [...tarefaKeys.all, "detail"] });
      const previous = queryClient.getQueriesData<TarefaDetail>({
        queryKey: [...tarefaKeys.all, "detail"],
      });

      for (const [key, detail] of previous) {
        if (!detail?.subtarefas?.some((s) => s.id === id)) continue;
        queryClient.setQueryData<TarefaDetail>(key, {
          ...detail,
          subtarefas: detail.subtarefas.map((s) =>
            s.id === id ? { ...s, concluida } : s,
          ),
        });
      }

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (sub) => {
      setTarefaDetail(queryClient, sub.tarefa_id, (old) => ({
        ...old,
        subtarefas: (old.subtarefas ?? []).map((s) => (s.id === sub.id ? sub : s)),
      }));
    },
  });
}

export function useDeleteSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; tarefaId: string }) => deleteSubtarefa(id),
    onSuccess: (_void, { id, tarefaId }) => {
      setTarefaDetail(queryClient, tarefaId, (old) => ({
        ...old,
        subtarefas: (old.subtarefas ?? []).filter((s) => s.id !== id),
      }));
    },
  });
}

export function useCreateTarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tarefaId, conteudo }: { tarefaId: string; conteudo: string }) =>
      createTarefaComentario(tarefaId, conteudo),
    onSuccess: (comentario, { tarefaId }) => {
      setTarefaDetail(queryClient, tarefaId, (old) => ({
        ...old,
        comentarios: [...(old.comentarios ?? []), comentario],
      }));
    },
  });
}

export function useDeleteTarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; tarefaId: string }) => deleteTarefaComentario(id),
    onSuccess: (_void, { id, tarefaId }) => {
      setTarefaDetail(queryClient, tarefaId, (old) => ({
        ...old,
        comentarios: (old.comentarios ?? []).filter((c) => c.id !== id),
      }));
    },
  });
}
