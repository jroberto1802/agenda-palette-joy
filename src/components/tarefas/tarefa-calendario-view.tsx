import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTarefasCalendario } from "@/hooks/use-tarefas";
import type { TarefaWithRelations } from "@/types";
import {
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
} from "@/utils/tarefas";

export function TarefaCalendarioView({
  onSelectTarefa,
}: {
  onSelectTarefa: (id: string) => void;
}) {
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()));
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(() => new Date());

  const inicio = startOfMonth(mesAtual).toISOString();
  const fim = endOfMonth(mesAtual).toISOString();

  const { data: tarefas, isLoading } = useTarefasCalendario(inicio, fim);

  const diasComTarefas = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tarefas ?? []) {
      if (!t.data_vencimento) continue;
      const key = format(parseISO(t.data_vencimento), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [tarefas]);

  const tarefasDoDia = useMemo(() => {
    return (tarefas ?? []).filter(
      (t) => t.data_vencimento && isSameDay(parseISO(t.data_vencimento), diaSelecionado),
    );
  }, [tarefas, diaSelecionado]);

  const modifiers = useMemo(
    () => ({
      hasTasks: (date: Date) => diasComTarefas.has(format(date, "yyyy-MM-dd")),
    }),
    [diasComTarefas],
  );

  const modifiersClassNames = {
    hasTasks: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base capitalize">
            {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMesAtual((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMesAtual((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <Calendar
              mode="single"
              selected={diaSelecionado}
              onSelect={(d) => d && setDiaSelecionado(d)}
              month={mesAtual}
              onMonthChange={setMesAtual}
              locale={ptBR}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className="w-full"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Timeline — {format(diaSelecionado, "dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : tarefasDoDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa com vencimento neste dia.</p>
          ) : (
            <div className="space-y-3">
              {tarefasDoDia.map((tarefa) => (
                <TimelineItem key={tarefa.id} tarefa={tarefa} onClick={() => onSelectTarefa(tarefa.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineItem({
  tarefa,
  onClick,
}: {
  tarefa: TarefaWithRelations;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex flex-wrap gap-2 mb-2">
        <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[tarefa.prioridade]}>
          {tarefa.prioridade}
        </Badge>
        <Badge variant="secondary" className={TAREFA_STATUS_COLORS[tarefa.status]}>
          {TAREFA_STATUS_LABELS[tarefa.status]}
        </Badge>
        {tarefa.setor && (
          <Badge variant="outline" style={{ borderColor: tarefa.setor.cor ?? undefined }}>
            {tarefa.setor.nome}
          </Badge>
        )}
      </div>
      <p className="font-medium">{tarefa.titulo}</p>
      {tarefa.responsavel && (
        <p className="text-xs text-muted-foreground mt-1">
          Responsável: {tarefa.responsavel.nome_completo}
        </p>
      )}
      {tarefa.data_vencimento && (
        <p className="text-xs text-muted-foreground">
          {format(parseISO(tarefa.data_vencimento), "HH:mm", { locale: ptBR })}
        </p>
      )}
    </button>
  );
}
