import { useAuth } from "@/hooks/use-auth";
import { materializarOcorrenciasDevidas } from "@/services/tarefa-recorrencia";
import { tarefaKeys } from "@/lib/query-keys";
import { startOfTodayLocal, toLocalDateKey } from "@/utils/agenda-datas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

/**
 * Materializa ocorrências devidas (data <= hoje).
 * Reexecuta quando:
 * - o usuário autentica
 * - o dia civil local muda (aba aberta overnight)
 * - a janela volta ao foco / fica visível
 */
export function useMaterializarRecorrencias() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastRunKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    const userId = user?.id;
    if (!userId || inFlight.current) return;

    const hojeKey = toLocalDateKey(startOfTodayLocal())!;
    const runKey = `${userId}:${hojeKey}`;
    if (lastRunKey.current === runKey) return;

    inFlight.current = true;
    try {
      const criadas = await materializarOcorrenciasDevidas();
      lastRunKey.current = runKey;
      if (criadas > 0) {
        queryClient.invalidateQueries({ queryKey: tarefaKeys.all });
      }
    } catch {
      // Falha transitória: permite nova tentativa no próximo foco/tick
      lastRunKey.current = null;
    } finally {
      inFlight.current = false;
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const onFocus = () => {
      // Força reavaliação do dia ao voltar o foco
      const hojeKey = toLocalDateKey(startOfTodayLocal())!;
      const userId = user?.id;
      if (!userId) return;
      const runKey = `${userId}:${hojeKey}`;
      if (lastRunKey.current !== runKey) {
        void run();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };

    // Catch-up se a aba ficar aberta após a meia-noite
    const interval = window.setInterval(() => {
      const hojeKey = toLocalDateKey(startOfTodayLocal())!;
      const userId = user?.id;
      if (!userId) return;
      const runKey = `${userId}:${hojeKey}`;
      if (lastRunKey.current !== runKey) {
        void run();
      }
    }, 60_000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [run, user?.id]);
}
