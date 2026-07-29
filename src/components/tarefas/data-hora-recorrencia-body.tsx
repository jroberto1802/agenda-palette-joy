import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { RecorrenciaEditor } from "@/components/tarefas/recorrencia-popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RecorrenciaConfig } from "@/types";
import {
  applyTimeToDate,
  getTimeInputValue,
  hasExplicitTime,
  localDateAtNoon,
  replaceDateKeepingTime,
} from "@/utils/agenda-datas";
import { formatRecorrencia, parseRecorrencia } from "@/utils/recorrencia";

type Panel = "calendario" | "hora" | "repetir";

/** calendario = Data+Hora (sem Repetir). recorrencia = frequência+Hora (sem calendário). */
export type DataHoraDateMode = "calendario" | "recorrencia";

export function DataHoraRecorrenciaBody({
  value,
  onChange,
  canEdit,
  recorrencia,
  onRecorrenciaChange,
  dateMode = "calendario",
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  canEdit: boolean;
  recorrencia?: RecorrenciaConfig | null;
  onRecorrenciaChange?: (config: RecorrenciaConfig | null) => void | Promise<void>;
  dateMode?: DataHoraDateMode;
}) {
  const isRecorrenciaMode = dateMode === "recorrencia";
  const [panel, setPanel] = useState<Panel>(isRecorrenciaMode ? "repetir" : "calendario");
  const [draftTime, setDraftTime] = useState("");

  useEffect(() => {
    setDraftTime(getTimeInputValue(value));
  }, [value]);

  useEffect(() => {
    setPanel(isRecorrenciaMode ? "repetir" : "calendario");
  }, [isRecorrenciaMode]);

  const recorrenciaParsed = parseRecorrencia(recorrencia ?? null);
  const timeLabel = hasExplicitTime(value) ? getTimeInputValue(value) : null;

  const backFromHora = () => setPanel(isRecorrenciaMode ? "repetir" : "calendario");

  if (panel === "hora") {
    return (
      <div className="w-[280px] space-y-3 p-3">
        <p className="text-sm font-medium">Horário</p>
        <p className="text-xs text-muted-foreground">
          {isRecorrenciaMode
            ? "Hora padrão das ocorrências futuras."
            : "Opcional — a data pode ficar sem horário."}
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Hora</Label>
          <Input
            type="time"
            value={draftTime}
            disabled={!canEdit || (!value && !isRecorrenciaMode)}
            onChange={(e) => setDraftTime(e.target.value)}
          />
        </div>
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canEdit || !value || !hasExplicitTime(value)}
            onClick={() => {
              if (!value) {
                setDraftTime("");
                backFromHora();
                return;
              }
              onChange(localDateAtNoon(value));
              setDraftTime("");
              backFromHora();
            }}
          >
            Remover hora
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={backFromHora}>
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canEdit || (!value && !isRecorrenciaMode)}
              onClick={() => {
                const base = value ?? localDateAtNoon(new Date());
                onChange(applyTimeToDate(base, draftTime || null));
                backFromHora();
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isRecorrenciaMode) {
    if (!onRecorrenciaChange) {
      return (
        <div className="w-80 p-3 text-sm text-muted-foreground">
          Recorrência indisponível.
        </div>
      );
    }
    return (
      <div className="w-80 space-y-0">
        <RecorrenciaEditor
          key={formatRecorrencia(recorrenciaParsed)}
          value={recorrenciaParsed}
          canEdit={canEdit}
          confirmAlteracao={false}
          nested
          onCancel={() => undefined}
          onConfirm={async (config) => {
            await onRecorrenciaChange(config);
          }}
        />
        <div className="flex flex-wrap gap-2 border-t px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!canEdit}
            onClick={() => setPanel("hora")}
          >
            <Clock className="h-3.5 w-3.5" />
            {timeLabel ? `Hora ${timeLabel}` : "Hora"}
          </Button>
        </div>
        {recorrenciaParsed && (
          <div className="border-t px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Atual: {formatRecorrencia(recorrenciaParsed)}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-auto">
      <Calendar
        mode="single"
        selected={value ?? undefined}
        onSelect={(date) => {
          if (!date) {
            onChange(null);
            return;
          }
          onChange(replaceDateKeepingTime(value, date));
        }}
        locale={ptBR}
        initialFocus
        disabled={!canEdit}
      />

      <div className="flex flex-wrap gap-2 border-t px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!canEdit || !value}
          onClick={() => setPanel("hora")}
        >
          <Clock className="h-3.5 w-3.5" />
          {timeLabel ? `Hora ${timeLabel}` : "Hora"}
        </Button>
      </div>

      {value && (
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={!canEdit}
            onClick={() => onChange(null)}
          >
            Remover data
          </Button>
        </div>
      )}
    </div>
  );
}

export function formatDataHoraLabel(date: Date | null): string {
  if (!date) return "Data";
  const base = format(date, "dd/MM/yyyy", { locale: ptBR });
  if (!hasExplicitTime(date)) return `Data: ${base}`;
  return `Data: ${base} ${getTimeInputValue(date)}`;
}

export function formatRecorrenciaHoraLabel(
  recorrencia: RecorrenciaConfig | null,
  date: Date | null,
): string {
  const freq = recorrencia ? formatRecorrencia(recorrencia) : "Definir recorrência";
  if (date && hasExplicitTime(date)) {
    return `${freq} · ${getTimeInputValue(date)}`;
  }
  return freq;
}
