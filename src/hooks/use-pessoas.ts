import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profileKeys, projetoKeys, setorKeys, tarefaKeys } from "@/lib/query-keys";
import {
  createPessoa,
  deletePessoa,
  desativarPessoa,
  listPessoas,
  reativarPessoa,
  updatePessoa,
  type PessoaDesativarTransferInput,
} from "@/services/pessoas";
import type { ProfileFormData } from "@/types";

export function usePessoas(
  search?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: profileKeys.list(search),
    queryFn: () => listPessoas(search),
    enabled: options?.enabled ?? true,
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

export function useDesativarPessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      transfer,
    }: {
      id: string;
      transfer?: PessoaDesativarTransferInput;
    }) => desativarPessoa(id, transfer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
      queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
      queryClient.invalidateQueries({ queryKey: projetoKeys.all });
    },
  });
}

export function useReativarPessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reativarPessoa(id),
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
