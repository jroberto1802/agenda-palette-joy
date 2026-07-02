import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Moon, Sun, LogOut, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, signOut } = useAuth();
  const { mode, primary, accent, toggleMode, setPrimary, setAccent, reset } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Agenda</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleMode} aria-label="Alternar tema">
              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo 👋</CardTitle>
            <CardDescription>
              Fase 1 concluída: autenticação e tema configurados. Nas próximas fases vamos
              adicionar funcionários, tarefas e a visão em Kanban.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personalizar tema</CardTitle>
            <CardDescription>
              Escolha as cores e o modo (claro / escuro). As preferências ficam salvas neste
              navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ColorPicker
                label="Cor primária"
                value={primary}
                onChange={setPrimary}
                description="Botões, destaques e links."
              />
              <ColorPicker
                label="Cor de acento"
                value={accent}
                onChange={setAccent}
                description="Áreas secundárias e hover."
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="mode-toggle" className="text-sm">
                  Modo
                </Label>
                <Button
                  id="mode-toggle"
                  variant="outline"
                  size="sm"
                  onClick={toggleMode}
                  className="gap-2"
                >
                  {mode === "dark" ? (
                    <>
                      <Moon className="h-4 w-4" /> Escuro
                    </>
                  ) : (
                    <>
                      <Sun className="h-4 w-4" /> Claro
                    </>
                  )}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Restaurar padrão
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button>Botão primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </main>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded-md border border-input cursor-pointer bg-transparent"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          spellCheck={false}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
