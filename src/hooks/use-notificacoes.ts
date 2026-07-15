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
import type { Notificacao } from "@/types";

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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificacaoKeys.all });

      const previousList = queryClient.getQueryData<Notificacao[]>(notificacaoKeys.list());
      const previousUnread = queryClient.getQueryData<number>(notificacaoKeys.unread());

      const wasUnread = previousList?.some((n) => n.id === id && !n.lida) ?? false;

      queryClient.setQueryData<Notificacao[]>(notificacaoKeys.list(), (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );

      if (wasUnread) {
        queryClient.setQueryData<number>(notificacaoKeys.unread(), (old) =>
          Math.max(0, (old ?? 0) - 1),
        );
      }

      return { previousList, previousUnread };
    },
    onError: (_error, _id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificacaoKeys.list(), context.previousList);
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(notificacaoKeys.unread(), context.previousUnread);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificacaoKeys.all });
    },
  });
}

export function useMarkAllNotificacoesLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificacoesLidas(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificacaoKeys.all });

      const previousList = queryClient.getQueryData<Notificacao[]>(notificacaoKeys.list());
      const previousUnread = queryClient.getQueryData<number>(notificacaoKeys.unread());

      queryClient.setQueryData<Notificacao[]>(notificacaoKeys.list(), (old) =>
        (old ?? []).map((n) => (n.lida ? n : { ...n, lida: true })),
      );
      queryClient.setQueryData<number>(notificacaoKeys.unread(), 0);

      return { previousList, previousUnread };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificacaoKeys.list(), context.previousList);
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(notificacaoKeys.unread(), context.previousUnread);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificacaoKeys.all });
    },
  });
}
