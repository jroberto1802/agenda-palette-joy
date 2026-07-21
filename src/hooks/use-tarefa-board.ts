import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTarefaBoardColuna,
  deleteTarefaBoardColuna,
  ensureTarefaBoardColunas,
  listTarefaBoardItens,
  moveTarefaEntreColunas,
  renameTarefaBoardColuna,
  reorderTarefaBoardColunas,
  reorderTarefasLista,
  reorderTarefasNaColuna,
  syncTarefaBoardItens,
} from "@/services/tarefa-board";

export const tarefaBoardKeys = {
  all: ["tarefa-board"] as const,
  colunas: () => [...tarefaBoardKeys.all, "colunas"] as const,
  itens: () => [...tarefaBoardKeys.all, "itens"] as const,
};

export function useTarefaBoardColunas(enabled = true) {
  return useQuery({
    queryKey: tarefaBoardKeys.colunas(),
    queryFn: ensureTarefaBoardColunas,
    enabled,
  });
}

export function useTarefaBoardItens(enabled = true) {
  return useQuery({
    queryKey: tarefaBoardKeys.itens(),
    queryFn: listTarefaBoardItens,
    enabled,
  });
}

export function useSyncTarefaBoardItens() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tarefaIds: string[]) => syncTarefaBoardItens(tarefaIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.itens() });
    },
  });
}

export function useCreateTarefaBoardColuna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => createTarefaBoardColuna(nome),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.colunas() });
    },
  });
}

export function useRenameTarefaBoardColuna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      renameTarefaBoardColuna(id, nome),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.colunas() });
    },
  });
}

export function useDeleteTarefaBoardColuna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTarefaBoardColuna(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.all });
    },
  });
}

export function useReorderTarefaBoardColunas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedColunaIds: string[]) => reorderTarefaBoardColunas(orderedColunaIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.colunas() });
    },
  });
}

export function useMoveTarefaEntreColunas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moveTarefaEntreColunas,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.itens() });
    },
  });
}

export function useReorderTarefasNaColuna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderTarefasNaColuna,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.itens() });
    },
  });
}

export function useReorderTarefasLista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedTarefaIds: string[]) => reorderTarefasLista(orderedTarefaIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tarefaBoardKeys.itens() });
    },
  });
}
