import { addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CalendarDays,
  Check,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localDateAtNoon, startOfTodayLocal } from "@/utils/agenda-datas";

export function AgendaAtrasadasActionsMenu({
  onConcluir,
  onReagendar,
  onManter,
  onExcluir,
  label = "Ações do item atrasado",
}: {
  onConcluir: () => void;
  onReagendar: (dataInicio: string) => void;
  onManter: () => void;
  onExcluir: () => void;
  label?: string;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const reagendarPara = (date: Date) => {
    onReagendar(localDateAtNoon(date).toISOString());
  };

  return (
    <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem onClick={onConcluir}>
            <Check className="mr-2 h-4 w-4" />
            Concluir
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CalendarDays className="mr-2 h-4 w-4" />
              Reagendar
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => reagendarPara(startOfTodayLocal())}>
                Hoje
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => reagendarPara(addDays(startOfTodayLocal(), 1))}>
                Amanhã
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setCalendarOpen(true);
                }}
              >
                Escolher data…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={onManter}>
            <CalendarClock className="mr-2 h-4 w-4" />
            Manter atrasada
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExcluir} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="w-auto max-w-fit p-3">
          <DialogHeader>
            <DialogTitle>Escolher data</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            locale={ptBR}
            onSelect={(date) => {
              if (!date) return;
              reagendarPara(date);
              setCalendarOpen(false);
            }}
            initialFocus
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
