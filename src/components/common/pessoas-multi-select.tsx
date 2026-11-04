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

function PessoasChecklist({
  pessoas,
  value,
  onChange,
  disabled,
  emptyLabel,
  searchPlaceholder,
  showSelectAll,
  search,
  onSearchChange,
  lockedIds,
  pinnedIds,
  pinnedLabel,
  minSelected,
  onMinBlocked,
}: {
  pessoas: PessoaOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptyLabel: string;
  searchPlaceholder: string;
  showSelectAll: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  lockedIds: Set<string>;
  pinnedIds: Set<string>;
  pinnedLabel: string;
  minSelected: number;
  onMinBlocked?: () => void;
}) {
  const filteredPessoas = useMemo(() => {
    const term = normalizeSearchText(search);
    if (!term) return pessoas;
    return pessoas.filter((p) =>
      normalizeSearchText(p.nome_completo).includes(term),
    );
  }, [pessoas, search]);

  /** Pessoas fixas (ex.: Responsáveis na lista de Visualizadores) sempre contam como marcadas. */
  const isChecked = (id: string) => pinnedIds.has(id) || value.includes(id);

  const allFilteredSelected =
    filteredPessoas.length > 0 && filteredPessoas.every((p) => isChecked(p.id));

  /** Seleção final sempre soma as pessoas fixas — sem duplicar. */
  const withPinned = (ids: string[]) => [...new Set([...ids, ...pinnedIds])];

  /** Aplica a remoção respeitando pessoas fixas/travadas e o mínimo exigido. */
  const applyRemoval = (remove: Set<string>) => {
    const next = value.filter(
      (id) => !remove.has(id) || lockedIds.has(id) || pinnedIds.has(id),
    );
    if (next.length === value.length) return;
    if (next.length < minSelected) {
      onMinBlocked?.();
      return;
    }
    onChange(withPinned(next));
  };

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange(withPinned([...value, id]));
      return;
    }
    applyRemoval(new Set([id]));
  };

  const toggleAllFiltered = (checked: boolean) => {
    const filteredIds = filteredPessoas.map((p) => p.id);
    if (checked) {
      onChange(withPinned([...value, ...filteredIds]));
      return;
    }
    applyRemoval(new Set(filteredIds));
  };

  if (!pessoas.length) {
    return <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col">
      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
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
              const pinned = pinnedIds.has(pessoa.id);
              const checked = isChecked(pessoa.id);
              const locked = pinned || (checked && lockedIds.has(pessoa.id));
              return (
                <label
                  key={pessoa.id}
                  title={
                    pinned
                      ? `${pinnedLabel}: não pode ser removido enquanto continuar como ${pinnedLabel}.`
                      : locked
                        ? "Somente o criador, o gestor ou o administrador podem remover esta pessoa."
                        : undefined
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/60",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => toggle(pessoa.id, !!next)}
                    disabled={disabled || locked}
                  />
                  <span className="min-w-0 flex-1 truncate">{pessoa.nome_completo}</span>
                  {pinned && (
                    <span className="shrink-0 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      {pinnedLabel}
                    </span>
                  )}
                  {checked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </label>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
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
  contentClassName,
  /** Lista embutida (sem segundo popover) — use dentro de Popover/Sheet já aberto. */
  inline = false,
  /**
   * Pessoas já selecionadas que NÃO podem ser desmarcadas (modo "somente adicionar":
   * Responsável/Visualizador só adicionam; remover é do Criador, Gestor e Administrador).
   */
  lockedIds,
  /**
   * Pessoas sempre selecionadas e travadas, com etiqueta (ex.: Responsáveis dentro da
   * lista de Visualizadores). A seleção final sempre soma estas pessoas, sem duplicar.
   */
  pinnedIds,
  /** Etiqueta exibida nas pessoas fixas. */
  pinnedLabel = "Responsável",
  /** Mínimo de pessoas que precisam permanecer selecionadas (ex.: 1 responsável na Tarefa). */
  minSelected = 0,
  /** Chamado ao tentar remover abaixo de `minSelected`. */
  onMinBlocked,
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
  /** z-index / classes extras do dropdown (precisa ficar acima de Dialog/Sheet). */
  contentClassName?: string;
  inline?: boolean;
  lockedIds?: string[];
  pinnedIds?: string[];
  pinnedLabel?: string;
  minSelected?: number;
  onMinBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const lockedSet = useMemo(() => new Set(lockedIds ?? []), [lockedIds]);
  const pinnedSet = useMemo(() => new Set(pinnedIds ?? []), [pinnedIds]);
  const [search, setSearch] = useState("");

  const selected = useMemo(() => {
    const set = new Set(value);
    return pessoas.filter((p) => set.has(p.id));
  }, [pessoas, value]);

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].nome_completo
        : `${selected.length} selecionados`;

  const list = (
    <PessoasChecklist
      pessoas={pessoas}
      value={value}
      onChange={onChange}
      disabled={disabled}
      emptyLabel={emptyLabel}
      searchPlaceholder={searchPlaceholder}
      showSelectAll={showSelectAll}
      search={search}
      onSearchChange={setSearch}
      lockedIds={lockedSet}
      pinnedIds={pinnedSet}
      pinnedLabel={pinnedLabel}
      minSelected={minSelected}
      onMinBlocked={onMinBlocked}
    />
  );

  if (inline) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-md border bg-popover text-popover-foreground",
          error && "border-destructive",
        )}
      >
        {list}
      </div>
    );
  }

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
      <PopoverContent
        className={cn(
          // Acima de Dialog (z-50) e do drawer de subtarefa (z-[70]).
          "z-[110] w-[var(--radix-popover-trigger-width)] p-0",
          contentClassName,
        )}
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const input = (event.currentTarget as HTMLElement).querySelector("input");
          input?.focus();
        }}
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}
