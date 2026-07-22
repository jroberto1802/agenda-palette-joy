import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RecorrenciaConfig, RecorrenciaTipo, RecorrenciaUnidade } from "@/types";
import {
  DIAS_SEMANA,
  RECORRENCIA_LABELS,
  formatRecorrencia,
  parseRecorrencia,
  serializeRecorrencia,
} from "@/utils/recorrencia";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toLocalDateKey } from "@/utils/agenda-datas";

const OVERLAY_Z = "z-[100]";

type Props = {
  value: RecorrenciaConfig | null;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: RecorrenciaConfig | null) => void | Promise<void>;
  trigger: React.ReactNode;
  /** Mensagem de confirmação ao alterar regra existente */
  confirmAlteracao?: boolean;
};

export function RecorrenciaPopover({
  value,
  canEdit,
  open,
  onOpenChange,
  onConfirm,
  trigger,
  confirmAlteracao = false,
}: Props) {
  const [tipo, setTipo] = useState<RecorrenciaTipo>(value?.tipo ?? "nenhuma");
  const [diasSemana, setDiasSemana] = useState<number[]>(value?.dias_semana ?? []);
  const [diaMes, setDiaMes] = useState(value?.dia_mes ?? 1);
  const [intervalo, setIntervalo] = useState(value?.intervalo ?? 1);
  const [unidade, setUnidade] = useState<RecorrenciaUnidade>(value?.unidade ?? "dias");
  const [datasLivres, setDatasLivres] = useState<Date[]>(
    (value?.datas_livres ?? []).map((d) => new Date(d + "T12:00:00")),
  );
  const [pendingConfirm, setPendingConfirm] = useState<"alterar" | "remover" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const parsed = parseRecorrencia(value) ?? null;
    setTipo(parsed?.tipo ?? "nenhuma");
    setDiasSemana(parsed?.dias_semana ?? []);
    setDiaMes(parsed?.dia_mes ?? 1);
    setIntervalo(parsed?.intervalo ?? 1);
    setUnidade(parsed?.unidade ?? "dias");
    setDatasLivres((parsed?.datas_livres ?? []).map((d) => new Date(d + "T12:00:00")));
    setPendingConfirm(null);
  }, [open, value]);

  const buildConfig = (): RecorrenciaConfig | null => {
    if (tipo === "nenhuma") return null;
    return serializeRecorrencia({
      tipo,
      dias_semana: tipo === "semanal" ? diasSemana : undefined,
      dia_mes: tipo === "mensal" ? diaMes : undefined,
      intervalo: tipo === "personalizada" || tipo === "anual" ? intervalo : undefined,
      unidade: tipo === "personalizada" ? unidade : undefined,
      datas_livres:
        tipo === "personalizada" && datasLivres.length > 0
          ? datasLivres.map((d) => toLocalDateKey(d)!).filter(Boolean)
          : undefined,
      data_ancora: value?.data_ancora ?? null,
      data_fim: value?.data_fim ?? null,
    });
  };

  const handleApply = async () => {
    const next = buildConfig();
    const hadRule = !!parseRecorrencia(value);
    if (confirmAlteracao && hadRule && !pendingConfirm) {
      setPendingConfirm(next ? "alterar" : "remover");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(next);
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar recorrência", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
      setPendingConfirm(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className={cn("w-80 space-y-3 p-3", OVERLAY_Z)} align="start">
        {pendingConfirm ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Confirmar alteração</p>
            <p className="text-sm text-muted-foreground">
              {pendingConfirm === "remover"
                ? "Essa tarefa deixará de gerar novas ocorrências. As ocorrências já existentes permanecerão disponíveis normalmente."
                : "A partir de agora, as próximas ocorrências seguirão essa nova regra. As ocorrências já existentes permanecerão inalteradas."}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPendingConfirm(null)}>
                Voltar
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void handleApply()}>
                Confirmar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {value && (
              <p className="text-xs text-muted-foreground">
                Atual: {formatRecorrencia(parseRecorrencia(value))}
              </p>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Frequência</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as RecorrenciaTipo)}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={OVERLAY_Z}>
                  {(Object.keys(RECORRENCIA_LABELS) as RecorrenciaTipo[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {RECORRENCIA_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipo === "semanal" && (
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((dia) => {
                  const selected = diasSemana.includes(dia.value);
                  return (
                    <label
                      key={dia.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs",
                        selected && "border-primary bg-primary/10",
                        !canEdit && "opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        disabled={!canEdit}
                        onCheckedChange={(checked) => {
                          setDiasSemana((prev) =>
                            checked
                              ? [...prev, dia.value]
                              : prev.filter((d) => d !== dia.value),
                          );
                        }}
                      />
                      {dia.label}
                    </label>
                  );
                })}
              </div>
            )}

            {tipo === "mensal" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Dia do mês</Label>
                <Select
                  value={String(diaMes)}
                  onValueChange={(v) => setDiaMes(Number(v))}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={OVERLAY_Z}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Dia {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipo === "anual" && (
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-xs">A cada</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 w-16"
                  value={intervalo}
                  disabled={!canEdit}
                  onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value) || 1))}
                />
                <span className="text-xs text-muted-foreground">
                  {intervalo === 1 ? "ano (mesma data)" : "anos (mesma data)"}
                </span>
              </div>
            )}

            {tipo === "personalizada" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="shrink-0 text-xs">A cada</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 w-16"
                    value={intervalo}
                    disabled={!canEdit}
                    onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value) || 1))}
                  />
                  <Select
                    value={unidade}
                    onValueChange={(v) => setUnidade(v as RecorrenciaUnidade)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={OVERLAY_Z}>
                      <SelectItem value="dias">dias</SelectItem>
                      <SelectItem value="semanas">semanas</SelectItem>
                      <SelectItem value="meses">meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ou selecione datas livres</Label>
                  <Calendar
                    mode="multiple"
                    selected={datasLivres}
                    onSelect={(days) => setDatasLivres(days ?? [])}
                    locale={ptBR}
                    disabled={!canEdit}
                  />
                  {datasLivres.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {datasLivres
                        .map((d) => format(d, "dd/MM", { locale: ptBR }))
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="button" size="sm" disabled={saving} onClick={() => void handleApply()}>
                  Aplicar
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
