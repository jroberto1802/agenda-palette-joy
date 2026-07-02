import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfileWithSetor, SetorWithGerente, TarefaFilters } from "@/types";
import { TAREFA_PRIORIDADE_LABELS, TAREFA_STATUS_LABELS } from "@/utils/tarefas";

export function TarefaFiltersBar({
  filters,
  onChange,
  setores,
  pessoas,
}: {
  filters: TarefaFilters;
  onChange: (filters: TarefaFilters) => void;
  setores: SetorWithGerente[];
  pessoas: ProfileWithSetor[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <div className="relative lg:col-span-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas..."
          className="pl-9"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <Select
        value={filters.status ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, status: v as TarefaFilters["status"] })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {Object.entries(TAREFA_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.prioridade ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, prioridade: v as TarefaFilters["prioridade"] })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          {Object.entries(TAREFA_PRIORIDADE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.setor_id ?? "all"}
        onValueChange={(v) => onChange({ ...filters, setor_id: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os setores</SelectItem>
          {setores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.atribuido_a ?? "all"}
        onValueChange={(v) => onChange({ ...filters, atribuido_a: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos responsáveis</SelectItem>
          {pessoas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome_completo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Filtrar por tag..."
        value={filters.tag ?? ""}
        onChange={(e) => onChange({ ...filters, tag: e.target.value })}
      />
    </div>
  );
}
