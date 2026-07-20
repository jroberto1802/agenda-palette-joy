import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subtarefaKeys, tarefaKeys } from "@/lib/query-keys";
import {
  createSubtarefa,
  createSubtarefaComentario,
  createTarefa,
  createTarefaComentario,
  deleteSubtarefa,
  deleteSubtarefaComentario,
  deleteTarefaComentario,
  getDashboardKpis,
  getSubtarefaDetail,
  getTarefaDetail,
  listRecentTarefas,
  listSubtarefasAgenda,
  listTarefas,
  listTarefasCalendario,
  reorderSubtarefas,
  softDeleteTarefa,
  toggleSubtarefa,
  updateSubtarefa,
  updateSubtarefaComentario,
  updateSubtarefaMeta,
  updateSubtarefaTitulo,
  updateTarefa,
  updateTarefaComentario,
  updateTarefaConclusao,
} from "@/services/tarefas";
import type {
  SubtarefaAgendaFilters,
  SubtarefaDetail,
  SubtarefaFormData,
  TarefaDetail,
  TarefaFilters,
  TarefaFormData,
} from "@/types";
import { sortSubtarefasList } from "@/utils/tarefas";

function invalidateTarefas(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
  queryClient.invalidateQueries({ queryKey: subtarefaKeys.all });
}

export function useTarefas(
  filters: TarefaFilters = {},
  options?: { enabled?: boolean },
) {
  const filterKey = {
    search: filters.search ?? "",
    prioridade: filters.prioridade ?? "all",
    setor_id: filters.setor_id ?? "all",
    projeto_id: filters.projeto_id ?? "all",
    atribuido_a: filters.atribuido_a ?? "all",
    atribuido_ids: [...(filters.atribuido_ids ?? [])].sort().join(","),
    tag: filters.tag ?? "",
    somente_finalizadas: filters.somente_finalizadas ? "1" : "0",
    excluir_finalizadas: filters.excluir_finalizadas ? "1" : "0",
    periodo_inicio: filters.periodo_inicio ?? "",
    periodo_fim: filters.periodo_fim ?? "",
    data_inicio_de: filters.data_inicio_de ?? "",
    data_inicio_ate: filters.data_inicio_ate ?? "",
  };

  return useQuery({
    queryKey: tarefaKeys.list(filterKey),
    queryFn: () => listTarefas(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useSubtarefasAgenda(
  filters: SubtarefaAgendaFilters,
  options?: { enabled?: boolean },
) {
  const filterKey = {
    usuario_id: filters.usuario_id,
    data_inicio_de: filters.data_inicio_de,
    data_inicio_ate: filters.data_inicio_ate,
  };

  return useQuery({
    queryKey: subtarefaKeys.agenda(filterKey),
    queryFn: () => listSubtarefasAgenda(filters),
    enabled: (options?.enabled ?? true) && !!filters.usuario_id,
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

export function useUpdateTarefaConclusao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      updateTarefaConclusao(id, concluida),
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
    mutationFn: ({ tarefaId, titulo }: { tarefaId: string; titulo: string }) =>
      createSubtarefa(tarefaId, titulo),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useReorderSubtarefas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tarefaId,
      orderedIds,
    }: {
      tarefaId: string;
      orderedIds: string[];
    }) => reorderSubtarefas(tarefaId, orderedIds),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useToggleSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      toggleSubtarefa(id, concluida),
    onMutate: async ({ id, concluida }) => {
      await queryClient.cancelQueries({ queryKey: tarefaKeys.all });
      await queryClient.cancelQueries({ queryKey: subtarefaKeys.detail(id) });

      const previousTarefas = queryClient.getQueriesData<TarefaDetail>({
        queryKey: [...tarefaKeys.all, "detail"],
      });
      const previousSubtarefa = queryClient.getQueryData<SubtarefaDetail>(
        subtarefaKeys.detail(id),
      );

      queryClient.setQueriesData<TarefaDetail>(
        { queryKey: [...tarefaKeys.all, "detail"] },
        (old) => {
          if (!old?.subtarefas?.some((s) => s.id === id)) return old;
          const subtarefas = sortSubtarefasList(
            old.subtarefas.map((s) => (s.id !== id ? s : { ...s, concluida })),
          );
          return { ...old, subtarefas };
        },
      );

      queryClient.setQueryData<SubtarefaDetail>(subtarefaKeys.detail(id), (old) => {
        if (!old) return old;
        return { ...old, concluida };
      });

      return { previousTarefas, previousSubtarefa, id };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previousTarefas ?? []) {
        queryClient.setQueryData(key, data);
      }
      if (context?.id) {
        queryClient.setQueryData(
          subtarefaKeys.detail(context.id),
          context.previousSubtarefa,
        );
      }
    },
    onSettled: () => invalidateTarefas(queryClient),
  });
}

export function useUpdateSubtarefaTitulo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, titulo }: { id: string; titulo: string }) =>
      updateSubtarefaTitulo(id, titulo),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}

export function useUpdateSubtarefaMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        data_inicio?: string | null;
        atribuido_ids?: string[];
        visibilidade?: import("@/types").Subtarefa["visibilidade"];
      };
    }) => updateSubtarefaMeta(id, data),
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

export function useSubtarefaDetail(id: string | null) {
  return useQuery({
    queryKey: subtarefaKeys.detail(id ?? ""),
    queryFn: () => getSubtarefaDetail(id!),
    enabled: !!id,
  });
}

export function useUpdateSubtarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubtarefaFormData }) =>
      updateSubtarefa(id, data),
    onSuccess: (_data, { id }) => {
      invalidateTarefas(queryClient);
      queryClient.invalidateQueries({ queryKey: subtarefaKeys.detail(id) });
    },
  });
}

export function useCreateSubtarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subtarefaId,
      conteudo,
      parentId = null,
    }: {
      subtarefaId: string;
      conteudo: string;
      parentId?: string | null;
    }) => createSubtarefaComentario(subtarefaId, conteudo, parentId),
    onSuccess: (_data, { subtarefaId }) => {
      invalidateTarefas(queryClient);
      queryClient.invalidateQueries({ queryKey: subtarefaKeys.detail(subtarefaId) });
    },
  });
}

export function useDeleteSubtarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subtarefaId }: { id: string; subtarefaId: string }) =>
      deleteSubtarefaComentario(id).then(() => subtarefaId),
    onSuccess: (_data, { subtarefaId }) => {
      invalidateTarefas(queryClient);
      queryClient.invalidateQueries({ queryKey: subtarefaKeys.detail(subtarefaId) });
    },
  });
}

export function useUpdateSubtarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      subtarefaId,
      conteudo,
    }: {
      id: string;
      subtarefaId: string;
      conteudo: string;
    }) => updateSubtarefaComentario(id, conteudo).then(() => subtarefaId),
    onSuccess: (_data, { subtarefaId }) => {
      invalidateTarefas(queryClient);
      queryClient.invalidateQueries({ queryKey: subtarefaKeys.detail(subtarefaId) });
    },
  });
}

export function useCreateTarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tarefaId,
      conteudo,
      parentId = null,
    }: {
      tarefaId: string;
      conteudo: string;
      parentId?: string | null;
    }) => createTarefaComentario(tarefaId, conteudo, parentId),
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

export function useUpdateTarefaComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, conteudo }: { id: string; conteudo: string }) =>
      updateTarefaComentario(id, conteudo),
    onSuccess: () => invalidateTarefas(queryClient),
  });
}
