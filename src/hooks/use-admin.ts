import { useMutation } from "@tanstack/react-query";
import { criarUsuarioAdmin } from "@/services/admin";
import type { AdminCreateUserData } from "@/types";

export function useCriarUsuarioAdmin() {
  return useMutation({
    mutationFn: (data: AdminCreateUserData) => criarUsuarioAdmin(data),
  });
}
