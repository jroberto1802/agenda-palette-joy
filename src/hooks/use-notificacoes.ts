import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { notificacaoKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  countNotificacoesNaoLidas,
  listNotificacoes,
  markAllNotificacoesLidas,
  markNotificacaoLida,
} from "@/services/notificacoes";

export function useNotificacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: notificacaoKeys.list(),
    queryFn: () => listNotificacoes(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const unreadQuery = useQuery({
    queryKey: notificacaoKeys.unread(),
    queryFn: () => countNotificacoesNaoLidas(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notificacoes:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificacaoKeys.all });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return { ...listQuery, unreadCount: unreadQuery.data ?? 0 };
}

export function useMarkNotificacaoLida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificacaoLida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificacaoKeys.all }),
  });
}

export function useMarkAllNotificacoesLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificacoesLidas(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificacaoKeys.all }),
  });
}
