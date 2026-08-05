import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PageHeaderValue = {
  title: ReactNode;
  subtitle?: ReactNode;
};

type PageHeaderContextValue = {
  header: PageHeaderValue | null;
  setHeader: (value: PageHeaderValue | null) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

/** Envolve o AppShell: guarda o título/subtítulo da página atual para o header fixo. */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderValue | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  );
}

function usePageHeaderContext(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeader deve ser usado dentro de PageHeaderProvider (AppShell)");
  }
  return ctx;
}

/**
 * Define o título/subtítulo exibidos no header fixo do layout autenticado.
 * Chame no topo de cada página de rota — o conteúdo é limpo automaticamente
 * ao desmontar (troca de rota).
 */
export function usePageHeader({ title, subtitle }: PageHeaderValue): void {
  const { setHeader } = usePageHeaderContext();
  useEffect(() => {
    setHeader({ title, subtitle });
    return () => setHeader(null);
  }, [setHeader, title, subtitle]);
}

/** Uso interno do AppShell para renderizar o título/subtítulo atual no header. */
export function usePageHeaderValue(): PageHeaderValue | null {
  return usePageHeaderContext().header;
}
