import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMarkAllNotificacoesLidas,
  useMarkNotificacaoLida,
  useNotificacoes,
} from "@/hooks/use-notificacoes";
import { cn } from "@/lib/utils";
import type { Notificacao } from "@/types";
import {
  getNotificacaoMensagem,
  getNotificacaoNavigateTarget,
  OPEN_NOTIFICATIONS_EVENT,
} from "@/utils/notificacoes";

type NotificacoesTab = "nao_lidas" | "lidas";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notificacoes, unreadCount } = useNotificacoes();
  const markLida = useMarkNotificacaoLida();
  const markAll = useMarkAllNotificacoesLidas();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificacoesTab>("nao_lidas");

  useEffect(() => {
    const handleOpen = () => {
      setTab("nao_lidas");
      setOpen(true);
    };
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, handleOpen);
  }, []);

  const naoLidas = useMemo(
    () => (notificacoes ?? []).filter((n) => !n.lida),
    [notificacoes],
  );
  const lidas = useMemo(
    () => (notificacoes ?? []).filter((n) => n.lida),
    [notificacoes],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setTab("nao_lidas");
  };

  const handleSelect = async (notificacao: Notificacao) => {
    // Marca como lida antes de fechar/navegar (update otimista no cache).
    if (!notificacao.lida) {
      try {
        await markLida.mutateAsync(notificacao.id);
      } catch {
        // Ainda navega; a invalidação no onSettled tenta re-sincronizar.
      }
    }

    setOpen(false);

    const target = getNotificacaoNavigateTarget(notificacao);
    if (target.search) {
      void navigate({ to: target.to, search: target.search });
    } else {
      void navigate({ to: target.to });
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 p-1 text-xs"
              onClick={(event) => {
                event.preventDefault();
                markAll.mutate();
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as NotificacoesTab)}
          className="gap-0"
        >
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full grid-cols-2">
              <TabsTrigger
                value="nao_lidas"
                className="h-7 text-xs"
                onPointerDown={(event) => event.preventDefault()}
              >
                Não lidas
                {unreadCount > 0 && (
                  <span className="ml-1 tabular-nums text-muted-foreground">
                    ({unreadCount > 9 ? "9+" : unreadCount})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="lidas"
                className="h-7 text-xs"
                onPointerDown={(event) => event.preventDefault()}
              >
                Lidas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="nao_lidas" className="mt-0">
            <NotificacoesList
              items={naoLidas}
              emptyMessage="Nenhuma notificação não lida"
              unreadStyle
              onSelect={handleSelect}
            />
          </TabsContent>

          <TabsContent value="lidas" className="mt-0">
            <NotificacoesList
              items={lidas}
              emptyMessage="Nenhuma notificação lida"
              onSelect={handleSelect}
            />
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificacoesList({
  items,
  emptyMessage,
  unreadStyle = false,
  onSelect,
}: {
  items: Notificacao[];
  emptyMessage: string;
  unreadStyle?: boolean;
  onSelect: (notificacao: Notificacao) => void | Promise<void>;
}) {
  return (
    <ScrollArea className="h-72">
      {!items.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        items.map((n) => (
          <DropdownMenuItem
            key={n.id}
            className={cn(
              "flex cursor-pointer flex-col items-start gap-1 rounded-none px-3 py-3",
              unreadStyle && "bg-primary/5",
            )}
            onSelect={(event) => {
              // Evita fechar o menu antes da marcação assíncrona concluir.
              event.preventDefault();
              void onSelect(n);
            }}
          >
            <span className="text-sm font-medium leading-snug">{getNotificacaoMensagem(n)}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </DropdownMenuItem>
        ))
      )}
    </ScrollArea>
  );
}
