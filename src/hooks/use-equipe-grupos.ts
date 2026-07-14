import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipeGrupoKeys } from "@/lib/query-keys";
import {
  createEquipeGrupo,
  deleteEquipeGrupo,
  listEquipeGrupos,
  movePessoaEquipeGrupo,
  renameEquipeGrupo,
} from "@/services/equipe-grupos";

export function useEquipeGrupos() {
  return useQuery({
    queryKey: equipeGrupoKeys.list(),
    queryFn: listEquipeGrupos,
  });
}

export function useCreateEquipeGrupo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => createEquipeGrupo(nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipeGrupoKeys.all });
    },
  });
}

export function useRenameEquipeGrupo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => renameEquipeGrupo(id, nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipeGrupoKeys.all });
    },
  });
}

export function useDeleteEquipeGrupo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEquipeGrupo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipeGrupoKeys.all });
    },
  });
}

export function useMovePessoaEquipeGrupo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      usuarioId,
      grupoId,
    }: {
      usuarioId: string;
      grupoId: string | null;
    }) => movePessoaEquipeGrupo(usuarioId, grupoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipeGrupoKeys.all });
    },
  });
}
