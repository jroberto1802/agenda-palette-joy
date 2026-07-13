import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import type {
  ProfileWithSetor,
  Projeto,
  SetorWithGerente,
  TarefaFilters,
} from "@/types";
import { TAREFA_PRIORIDADE_LABELS, TAREFA_STATUS_LABELS } from "@/utils/tarefas";
import { cn } from "@/lib/utils";

export function TarefaFiltersBar({
  filters,
  onChange,
  setores,
  projetos,
  pessoas,
  hideResponsavel = false,
}: {
  filters: TarefaFilters;
  onChange: (filters: TarefaFilters) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  hideResponsavel?: boolean;
}) {
  const atribuidoIds = filters.atribuido_ids ?? [];

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        hideResponsavel ? "lg:grid-cols-6" : "lg:grid-cols-7",
      )}
    >
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
        value={filters.projeto_id ?? "all"}
        onValueChange={(v) => onChange({ ...filters, projeto_id: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Projeto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os projetos</SelectItem>
          {projetos.map((projeto) => (
            <SelectItem key={projeto.id} value={projeto.id}>
              {projeto.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!hideResponsavel && (
        <PessoasMultiSelect
          pessoas={pessoas}
          value={atribuidoIds}
          onChange={(ids) =>
            onChange({
              ...filters,
              atribuido_ids: ids,
              atribuido_a: "all",
            })
          }
          placeholder="Todos responsáveis"
          showSelectAll
        />
      )}

      <Input
        placeholder="Filtrar por tag..."
        value={filters.tag ?? ""}
        onChange={(e) => onChange({ ...filters, tag: e.target.value })}
      />
    </div>
  );
}
