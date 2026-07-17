import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { buscarConteudo } from "@/services/busca";

export const buscaKeys = {
  all: ["busca"] as const,
  term: (termo: string) => [...buscaKeys.all, termo] as const,
};

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

export function useBuscaConteudo(termo: string) {
  const debounced = useDebouncedValue(termo.trim(), 300);
  const enabled = debounced.length >= 2;

  const query = useQuery({
    queryKey: buscaKeys.term(debounced),
    queryFn: () => buscarConteudo(debounced),
    enabled,
  });

  return {
    ...query,
    termoDebounced: debounced,
    enabled,
  };
}
