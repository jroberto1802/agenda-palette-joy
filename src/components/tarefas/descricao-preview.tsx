export function DescricaoPreview({
  descricao,
  className,
}: {
  descricao?: string | null;
  className?: string;
}) {
  const text = descricao?.replace(/\s+/g, " ").trim();
  if (!text) return null;

  return (
    <p className={className ?? "line-clamp-2 text-xs leading-snug text-muted-foreground"}>
      {text}
    </p>
  );
}
