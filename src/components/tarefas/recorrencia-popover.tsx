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
  MESES_ANO,
  RECORRENCIA_LABELS,
  formatRecorrencia,
  parseRecorrencia,
  serializeRecorrencia,
} from "@/utils/recorrencia";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toLocalDateKey } from "@/utils/agenda-datas";

const OVERLAY_Z = "z-[100]";

function defaultsAnual(from: Date = new Date()) {
  return {
    dia: from.getDate(),
    mes: from.getMonth() + 1,
  };
}

export type RecorrenciaEditorProps = {
  value: RecorrenciaConfig | null;
  canEdit: boolean;
  confirmAlteracao?: boolean;
  onConfirm: (config: RecorrenciaConfig | null) => void | Promise<void>;
  onCancel?: () => void;
  /** Quando true, mostra botão Voltar em vez de Cancelar (painel aninhado). */
  nested?: boolean;
};

/** Formulário de recorrência reutilizável (popover ou painel interno). */
export function RecorrenciaEditor({
  value,
  canEdit,
  confirmAlteracao = false,
  onConfirm,
  onCancel,
  nested = false,
}: RecorrenciaEditorProps) {
  const anualDefaults = defaultsAnual();
  const [tipo, setTipo] = useState<RecorrenciaTipo>(value?.tipo ?? "nenhuma");
  const [diasSemana, setDiasSemana] = useState<number[]>(value?.dias_semana ?? []);
  const [diaMes, setDiaMes] = useState(value?.dia_mes ?? anualDefaults.dia);
  const [mes, setMes] = useState(value?.mes ?? anualDefaults.mes);
  const [intervalo, setIntervalo] = useState(value?.intervalo ?? 1);
  const [unidade, setUnidade] = useState<RecorrenciaUnidade>(value?.unidade ?? "dias");
  const [datasLivres, setDatasLivres] = useState<Date[]>(
    (value?.datas_livres ?? []).map((d) => new Date(d + "T12:00:00")),
  );
  const [pendingConfirm, setPendingConfirm] = useState<"alterar" | "remover" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const parsed = parseRecorrencia(value) ?? null;
    const defs = defaultsAnual();
    setTipo(parsed?.tipo ?? "nenhuma");
    setDiasSemana(parsed?.dias_semana ?? []);
    setDiaMes(parsed?.dia_mes ?? defs.dia);
    setMes(parsed?.mes ?? defs.mes);
    setIntervalo(parsed?.intervalo ?? 1);
    setUnidade(parsed?.unidade ?? "dias");
    setDatasLivres((parsed?.datas_livres ?? []).map((d) => new Date(d + "T12:00:00")));
    setPendingConfirm(null);
    // Só reidrata ao montar / trocar a regra persistida (não a cada render do pai)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync intencional por identidade tipada
  }, [
    value?.tipo,
    value?.dia_mes,
    value?.mes,
    value?.intervalo,
    value?.unidade,
    value?.data_ancora,
    value?.data_fim,
    JSON.stringify(value?.dias_semana ?? []),
    JSON.stringify(value?.datas_livres ?? []),
  ]);

  const buildConfig = (): RecorrenciaConfig | null => {
    if (tipo === "nenhuma") return null;
    return serializeRecorrencia({
      tipo,
      dias_semana: tipo === "semanal" ? diasSemana : undefined,
      dia_mes: tipo === "mensal" || tipo === "anual" ? diaMes : undefined,
      mes: tipo === "anual" ? mes : undefined,
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
    } catch (error) {
      toast.error("Erro ao salvar recorrência", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
      setPendingConfirm(null);
    }
  };

  if (pendingConfirm) {
    return (
      <div className="space-y-3 p-3">
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
    );
  }

  return (
    <div className="space-y-3 p-3">
      {value && (
        <p className="text-xs text-muted-foreground">
          Atual: {formatRecorrencia(parseRecorrencia(value))}
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Frequência</Label>
        <Select
          value={tipo}
          onValueChange={(v) => {
            const next = v as RecorrenciaTipo;
            setTipo(next);
            if (next === "anual") {
              const defs = defaultsAnual();
              setDiaMes((d) => (d >= 1 && d <= 31 ? d : defs.dia));
              setMes((m) => (m >= 1 && m <= 12 ? m : defs.mes));
            }
          }}
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
            value={String(Math.min(diaMes, 28))}
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
            <span className="text-xs text-muted-foreground">
              {intervalo === 1 ? "ano" : "anos"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Dia</Label>
              <Select
                value={String(diaMes)}
                onValueChange={(v) => setDiaMes(Number(v))}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={OVERLAY_Z}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mês</Label>
              <Select
                value={String(mes)}
                onValueChange={(v) => setMes(Number(v))}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={OVERLAY_Z}>
                  {MESES_ANO.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
                {datasLivres.map((d) => format(d, "dd/MM", { locale: ptBR })).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onCancel?.()}>
            {nested ? "Voltar" : "Cancelar"}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void handleApply()}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}

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
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className={cn("w-80 p-0", OVERLAY_Z)} align="start">
        <RecorrenciaEditor
          value={value}
          canEdit={canEdit}
          confirmAlteracao={confirmAlteracao}
          onConfirm={async (config) => {
            await onConfirm(config);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
