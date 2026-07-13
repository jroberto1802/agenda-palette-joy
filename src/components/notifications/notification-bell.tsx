import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
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
import {
  useMarkAllNotificacoesLidas,
  useMarkNotificacaoLida,
  useNotificacoes,
} from "@/hooks/use-notificacoes";
import { cn } from "@/lib/utils";
import {
  getNotificacaoMensagem,
  getNotificacaoNavigateTarget,
} from "@/utils/notificacoes";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notificacoes, unreadCount } = useNotificacoes();
  const markLida = useMarkNotificacaoLida();
  const markAll = useMarkAllNotificacoesLidas();

  const handleClick = async (id: string) => {
    const notificacao = notificacoes?.find((n) => n.id === id);
    if (!notificacao) return;

    if (!notificacao.lida) {
      await markLida.mutateAsync(id);
    }

    const target = getNotificacaoNavigateTarget(notificacao);
    navigate({
      to: target.to,
      ...(target.search ? { search: target.search } : {}),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs gap-1"
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-72">
          {!notificacoes?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
          ) : (
            notificacoes.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 cursor-pointer",
                  !n.lida && "bg-primary/5",
                )}
                onClick={() => handleClick(n.id)}
              >
                <span className="text-sm font-medium leading-snug">{getNotificacaoMensagem(n)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
