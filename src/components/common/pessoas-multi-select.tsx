import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ProfileWithSetor } from "@/types";

type PessoaOption = Pick<ProfileWithSetor, "id" | "nome_completo">;

/** Normaliza texto para busca (minúsculas, sem acento). */
function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function PessoasMultiSelect({
  pessoas,
  value,
  onChange,
  disabled,
  placeholder = "Selecione responsáveis",
  emptyLabel = "Nenhuma pessoa disponível",
  searchPlaceholder = "Buscar por nome...",
  showSelectAll = true,
  error,
}: {
  pessoas: PessoaOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  showSelectAll?: boolean;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(() => {
    const set = new Set(value);
    return pessoas.filter((p) => set.has(p.id));
  }, [pessoas, value]);

  const filteredPessoas = useMemo(() => {
    const term = normalizeSearchText(search);
    if (!term) return pessoas;
    return pessoas.filter((p) =>
      normalizeSearchText(p.nome_completo).includes(term),
    );
  }, [pessoas, search]);

  const allFilteredSelected =
    filteredPessoas.length > 0 &&
    filteredPessoas.every((p) => value.includes(p.id));

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

  const toggleAllFiltered = (checked: boolean) => {
    const filteredIds = filteredPessoas.map((p) => p.id);
    if (checked) {
      onChange([...new Set([...value, ...filteredIds])]);
      return;
    }
    const remove = new Set(filteredIds);
    onChange(value.filter((id) => !remove.has(id)));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
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
          <div className="flex flex-col">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  disabled={disabled}
                  className="h-8 pl-8"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto p-2">
              {filteredPessoas.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  Nenhuma pessoa encontrada.
                </p>
              ) : (
                <>
                  {showSelectAll && (
                    <label className="mb-1 flex cursor-pointer items-center gap-2 rounded-md border-b px-2 py-2 text-sm font-medium">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={(checked) => toggleAllFiltered(!!checked)}
                        disabled={disabled}
                      />
                      {search.trim() ? "Selecionar filtrados" : "Selecionar todos"}
                    </label>
                  )}
                  {filteredPessoas.map((pessoa) => {
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
                </>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
