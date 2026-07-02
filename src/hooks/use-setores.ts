import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setorKeys } from "@/lib/query-keys";
import { createSetor, deleteSetor, listSetores, updateSetor } from "@/services/setores";
import type { SetorFormData } from "@/types";

export function useSetores() {
  return useQuery({
    queryKey: setorKeys.list(),
    queryFn: listSetores,
  });
}

export function useCreateSetor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetorFormData) => createSetor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}

export function useUpdateSetor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SetorFormData }) => updateSetor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}

export function useDeleteSetor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSetor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}
