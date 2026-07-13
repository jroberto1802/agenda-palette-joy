import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { avisoKeys } from "@/lib/query-keys";
import {
  createAviso,
  createAvisoComentario,
  deleteAviso,
  getAvisoDetail,
  listAvisos,
  setAvisoLido,
} from "@/services/avisos";
import type { AvisoFormData } from "@/types";

export function useAvisos() {
  return useQuery({
    queryKey: avisoKeys.list(),
    queryFn: listAvisos,
  });
}

export function useAvisoDetail(id: string | null) {
  return useQuery({
    queryKey: avisoKeys.detail(id ?? ""),
    queryFn: () => getAvisoDetail(id!),
    enabled: !!id,
  });
}

export function useCreateAviso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AvisoFormData) => createAviso(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: avisoKeys.all }),
  });
}

export function useDeleteAviso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAviso(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: avisoKeys.all }),
  });
}

export function useCreateAvisoComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      avisoId,
      conteudo,
      parentId = null,
    }: {
      avisoId: string;
      conteudo: string;
      parentId?: string | null;
    }) => createAvisoComentario(avisoId, conteudo, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: avisoKeys.all }),
  });
}

export function useSetAvisoLido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ avisoId, lido }: { avisoId: string; lido: boolean }) =>
      setAvisoLido(avisoId, lido),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: avisoKeys.all }),
  });
}
