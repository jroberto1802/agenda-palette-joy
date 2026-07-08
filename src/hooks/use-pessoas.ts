import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profileKeys, setorKeys } from "@/lib/query-keys";
import { createPessoa, deletePessoa, listPessoas, updatePessoa } from "@/services/pessoas";
import type { ProfileFormData } from "@/types";

export function usePessoas(search?: string) {
  return useQuery({
    queryKey: profileKeys.list(search),
    queryFn: () => listPessoas(search),
  });
}

export function useCreatePessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProfileFormData) => createPessoa(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}

export function useUpdatePessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProfileFormData }) => updatePessoa(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}

export function useDeletePessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePessoa(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}

export function usePessoasParaSelect() {
  return useQuery({
    queryKey: [...profileKeys.all, "select"],
    queryFn: () => listPessoas(),
    select: (pessoas) => pessoas.filter((p) => p.ativo),
  });
}

export function useInvalidateSetoresOnPessoaChange() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: setorKeys.all });
}
