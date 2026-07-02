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
import { DIAS_SEMANA, RECORRENCIA_LABELS } from "@/utils/recorrencia";

type RecorrenciaFormValues = {
  recorrencia_tipo: RecorrenciaTipo;
  recorrencia_dias_semana: number[];
  recorrencia_dia_mes: number;
  recorrencia_data_fim: Date | null;
};

export function TarefaRecorrenciaFields<T extends RecorrenciaFormValues>({
  form,
}: {
  form: UseFormReturn<T>;
}) {
  const tipo = form.watch("recorrencia_tipo" as never) as RecorrenciaTipo;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="text-sm font-medium">Recorrência</h4>

      <FormField
        control={form.control}
        name={"recorrencia_tipo" as never}
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
          name={"recorrencia_dias_semana" as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dias da semana</FormLabel>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => {
                  const selected = (field.value as number[]).includes(dia.value);
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
                          const current = field.value as number[];
                          field.onChange(
                            checked
                              ? [...current, dia.value]
                              : current.filter((d) => d !== dia.value),
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
          name={"recorrencia_dia_mes" as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia do mês</FormLabel>
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

      {tipo !== "nenhuma" && (
        <FormField
          control={form.control}
          name={"recorrencia_data_fim" as never}
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
                        ? format(field.value as Date, "dd/MM/yyyy", { locale: ptBR })
                        : "Sem data limite"}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={(field.value as Date | null) ?? undefined}
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
