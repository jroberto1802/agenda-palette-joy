import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function ProfileAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} />
      <AvatarFallback className={cn("text-xs", fallbackClassName)}>
        {initials(name || "?")}
      </AvatarFallback>
    </Avatar>
  );
}
