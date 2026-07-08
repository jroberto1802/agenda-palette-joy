import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileKeys, setorKeys } from "@/lib/query-keys";
import { criarUsuarioAdmin } from "@/services/admin";
import type { AdminCreateUserData } from "@/types";

export function useCriarUsuarioAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminCreateUserData) => criarUsuarioAdmin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.invalidateQueries({ queryKey: setorKeys.all });
    },
  });
}
