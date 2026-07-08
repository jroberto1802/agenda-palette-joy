import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "light" | "dark";

interface ThemeContextValue {
  mode: Mode;
  primary: string; // hex, ex: "#3b82f6"
  accent: string; // hex
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  setPrimary: (hex: string) => void;
  setAccent: (hex: string) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_ACCENT = "#8b5cf6";
const STORAGE_KEY = "agenda-theme";

interface Stored {
  mode: Mode;
  primary: string;
  accent: string;
}

function loadStored(): Stored {
  if (typeof window === "undefined") {
    return { mode: "light", primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { mode: "light", primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return { mode: prefersDark ? "dark" : "light", primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT };
}

// Converte hex -> HSL string "H S% L%" para usar em CSS var, mas mais simples:
// aplicamos direto o hex nas variáveis de cor. shadcn tokens aceitam qualquer
// formato de cor válido (o browser resolve).
function applyTheme(s: Stored) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", s.mode === "dark");
  root.style.setProperty("--primary", s.primary);
  root.style.setProperty("--ring", s.primary);
  root.style.setProperty("--sidebar-primary", s.primary);
  root.style.setProperty("--accent", s.accent);
  // Não sobrescreve --sidebar / --sidebar-accent para manter o cinza do menu.
  root.style.setProperty("--primary-foreground", "#ffffff");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(() => loadStored());

  useEffect(() => {
    applyTheme(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const value: ThemeContextValue = {
    mode: state.mode,
    primary: state.primary,
    accent: state.accent,
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    toggleMode: () => setState((s) => ({ ...s, mode: s.mode === "light" ? "dark" : "light" })),
    setPrimary: (primary) => setState((s) => ({ ...s, primary })),
    setAccent: (accent) => setState((s) => ({ ...s, accent })),
    reset: () =>
      setState({ mode: state.mode, primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT }),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
