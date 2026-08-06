import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RecorrenciaTipo } from "@/types";
import { DIAS_SEMANA, MESES_ANO, RECORRENCIA_LABELS } from "@/utils/recorrencia";

export type RecorrenciaFormValues = {
  recorrencia_tipo: RecorrenciaTipo;
  recorrencia_dias_semana: number[];
  recorrencia_dia_mes: number;
  recorrencia_mes: number;
  recorrencia_data_fim: Date | null;
};

export function TarefaRecorrenciaFields({
  form,
}: {
  form: UseFormReturn<RecorrenciaFormValues>;
}) {
  const tipo = form.watch("recorrencia_tipo");

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="text-sm font-medium">Recorrência</h4>

      <FormField
        control={form.control}
        name="recorrencia_tipo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Frequência</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(Object.keys(RECORRENCIA_LABELS) as RecorrenciaTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {RECORRENCIA_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {tipo === "semanal" && (
        <FormField
          control={form.control}
          name="recorrencia_dias_semana"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dias da semana</FormLabel>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => {
                  const selected = field.value.includes(dia.value);
                  return (
                    <label
                      key={dia.value}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer",
                        selected && "border-primary bg-primary/10",
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => {
                          field.onChange(
                            checked
                              ? [...field.value, dia.value]
                              : field.value.filter((d) => d !== dia.value),
                          );
                        }}
                      />
                      {dia.label}
                    </label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {tipo === "mensal" && (
        <FormField
          control={form.control}
          name="recorrencia_dia_mes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia do mês</FormLabel>
              <Select
                value={String(Math.min(field.value, 28))}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Dia {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {tipo === "anual" && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="recorrencia_dia_mes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="recorrencia_mes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mês</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MESES_ANO.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {tipo !== "nenhuma" && (
        <FormField
          control={form.control}
          name="recorrencia_data_fim"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Repetir até (opcional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value
                        ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                        : "Sem data limite"}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ?? undefined}
                    onSelect={field.onChange}
                    locale={ptBR}
                    initialFocus
                  />
                  {field.value && (
                    <div className="p-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => field.onChange(null)}
                      >
                        Remover data limite
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
