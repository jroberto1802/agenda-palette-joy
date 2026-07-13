import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ProfileWithSetor } from "@/types";

type PessoaOption = Pick<ProfileWithSetor, "id" | "nome_completo">;

export function PessoasMultiSelect({
  pessoas,
  value,
  onChange,
  disabled,
  placeholder = "Selecione responsáveis",
  emptyLabel = "Nenhuma pessoa disponível",
  showSelectAll = true,
  error,
}: {
  pessoas: PessoaOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  showSelectAll?: boolean;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const set = new Set(value);
    return pessoas.filter((p) => set.has(p.id));
  }, [pessoas, value]);

  const allSelected = pessoas.length > 0 && pessoas.every((p) => value.includes(p.id));

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].nome_completo
        : `${selected.length} selecionados`;

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...new Set([...value, id])]);
      return;
    }
    onChange(value.filter((v) => v !== id));
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      onChange(pessoas.map((p) => p.id));
      return;
    }
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            selected.length === 0 && "text-muted-foreground",
            error && "border-destructive",
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {!pessoas.length ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="max-h-56 overflow-y-auto p-2">
            {showSelectAll && (
              <label className="mb-1 flex cursor-pointer items-center gap-2 rounded-md border-b px-2 py-2 text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                  disabled={disabled}
                />
                Selecionar todos
              </label>
            )}
            {pessoas.map((pessoa) => {
              const checked = value.includes(pessoa.id);
              return (
                <label
                  key={pessoa.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => toggle(pessoa.id, !!next)}
                    disabled={disabled}
                  />
                  <span className="min-w-0 flex-1 truncate">{pessoa.nome_completo}</span>
                  {checked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
