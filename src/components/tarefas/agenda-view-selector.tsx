import { Check, Columns3, LayoutGrid, List } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AgendaViewMode } from "@/utils/agenda-view-preference";

const VIEW_OPTIONS: {
  value: AgendaViewMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "colunas", label: "Colunas", icon: Columns3 },
];

export function AgendaViewSelector({
  value,
  onChange,
  hideColunas = false,
}: {
  value: AgendaViewMode;
  onChange: (view: AgendaViewMode) => void;
  hideColunas?: boolean;
}) {
  const options = hideColunas
    ? VIEW_OPTIONS.filter((o) => o.value !== "colunas")
    : VIEW_OPTIONS;
  const active = options.find((o) => o.value === value) ?? options[0];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-2 px-2.5"
          aria-label={`Visualização: ${active.label}`}
          title="Alternar visualização"
        >
          <ActiveIcon className="h-4 w-4" />
          <span className="hidden text-sm font-medium sm:inline">{active.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              className={cn("gap-2", selected && "bg-accent")}
              onClick={() => onChange(option.value)}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{option.label}</span>
              {selected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
