import { useAuth } from "@/hooks/use-auth";
import { materializarOcorrenciasDevidas } from "@/services/tarefa-recorrencia";
import { tarefaKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Materializa ocorrências devidas (data <= hoje) uma vez por sessão autenticada.
 * Não cria previsões futuras — só linhas reais quando a data chega.
 */
export function useMaterializarRecorrencias() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ranForUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    if (ranForUser.current === userId) return;
    ranForUser.current = userId;

    void materializarOcorrenciasDevidas()
      .then((criadas) => {
        if (criadas > 0) {
          queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
        }
      })
      .catch(() => undefined);
  }, [user?.id, queryClient]);
}
