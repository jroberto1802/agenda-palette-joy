import { ProfileAvatar } from "@/components/common/profile-avatar";
import type { AvisoWithRelations } from "@/types";
import { getAvisoDestinatarioLabel, getAvisoDestinatariosPessoas } from "@/utils/avisos";

const MAX_AVATARES = 5;

export function AvisoDestinatarioDisplay({
  aviso,
  compact = false,
}: {
  aviso: AvisoWithRelations;
  compact?: boolean;
}) {
  if (aviso.alcance === "pessoa_especifica") {
    const pessoas = getAvisoDestinatariosPessoas(aviso);
    const visiveis = pessoas.slice(0, MAX_AVATARES);
    const restantes = pessoas.length - visiveis.length;

    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex -space-x-2">
          {visiveis.map((pessoa) => (
            <ProfileAvatar
              key={pessoa.id}
              name={pessoa.nome_completo}
              avatarUrl={pessoa.avatar_url}
              className="h-6 w-6 border-2 border-background"
              fallbackClassName="text-[10px]"
            />
          ))}
          {restantes > 0 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
              +{restantes}
            </div>
          )}
        </div>
        {!compact && (
          <span className="truncate text-xs text-muted-foreground">
            {getAvisoDestinatarioLabel(aviso)}
          </span>
        )}
      </div>
    );
  }

  return (
    <p className="text-xs text-muted-foreground truncate">
      Para: {getAvisoDestinatarioLabel(aviso)}
    </p>
  );
}
