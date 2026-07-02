import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profileKeys, setorKeys } from "@/lib/query-keys";
import { listPessoas, updatePessoa } from "@/services/pessoas";
import type { ProfileFormData } from "@/types";

export function usePessoas(search?: string) {
  return useQuery({
    queryKey: profileKeys.list(search),
    queryFn: () => listPessoas(search),
  });
}

export function useUpdatePessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProfileFormData }) => updatePessoa(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
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
