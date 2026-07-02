import { Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";

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

export function ThemeSettingsCard() {
  const { mode, primary, accent, toggleMode, setPrimary, setAccent, reset } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Aparência</CardTitle>
        <CardDescription>
          Escolha o modo claro/escuro e as cores da interface. As preferências ficam salvas neste
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-4">
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
          <Button variant="ghost" size="sm" onClick={reset} className="gap-2 w-fit">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm">Botão primário</Button>
          <Button size="sm" variant="secondary">
            Secundário
          </Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
