import DOMPurify from "isomorphic-dompurify";

/** Cores pré-definidas do marca-texto (persistidas no atributo style/color do <mark>). */
export const HIGHLIGHT_COLORS = [
  { id: "amarelo", label: "Amarelo", color: "#fef08a" },
  { id: "verde", label: "Verde", color: "#bbf7d0" },
  { id: "azul", label: "Azul", color: "#bfdbfe" },
  { id: "vermelho", label: "Vermelho", color: "#fecaca" },
  { id: "laranja", label: "Laranja", color: "#fed7aa" },
] as const;

export type HighlightColorId = (typeof HIGHLIGHT_COLORS)[number]["id"];

/** Texto escuro sobre marca-texto pastel — legível em tema claro e escuro. */
export const HIGHLIGHT_TEXT_COLOR = "#171717";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "mark",
  "span",
];

const ALLOWED_ATTR = ["style", "class", "data-color"];

/** Detecta se o conteúdo parece HTML rico (vs texto legado). */
export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Remove tags HTML e compacta espaços — útil para menções, preview e validação. */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converte texto plano legado para HTML mínimo do TipTap. */
export function plainTextToHtml(plain: string): string {
  if (!plain) return "";
  if (looksLikeHtml(plain)) return plain;
  const paragraphs = plain.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      const withBreaks = escapeHtml(p).replace(/\n/g, "<br>");
      return `<p>${withBreaks || "<br>"}</p>`;
    })
    .join("");
}

/** Conteúdo vazio do editor TipTap → string vazia para persistência. */
export function normalizeRichTextOutput(html: string): string {
  if (!html) return "";
  const text = stripHtml(html);
  if (!text) return "";
  // TipTap Highlight usa `color: inherit` — normaliza para texto escuro legível no dark mode
  return normalizeHighlightContrast(html);
}

/**
 * Garante contraste do marca-texto: fundos pastéis claros com texto escuro.
 * Evita bloco ilegível no tema escuro (texto claro herdado sobre highlight).
 */
export function normalizeHighlightContrast(html: string): string {
  if (!html || !html.includes("<mark")) return html;

  return html.replace(/<mark\b([^>]*)>/gi, (_full, rawAttrs: string) => {
    let attrs = rawAttrs ?? "";
    const dataColor = attrs.match(/\bdata-color\s*=\s*("([^"]*)"|'([^']*)')/i);
    const bgFromData = dataColor?.[2] ?? dataColor?.[3];

    if (/\bstyle\s*=\s*/i.test(attrs)) {
      attrs = attrs.replace(
        /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i,
        (_s, _q, doubleVal?: string, singleVal?: string) => {
          const current = doubleVal ?? singleVal ?? "";
          const withoutColor = current
            .replace(/(?:^|;)\s*color\s*:[^;]*/gi, "")
            .replace(/;;+/g, ";")
            .replace(/^;|;$/g, "")
            .trim();
          const bgMatch = withoutColor.match(/background-color\s*:\s*([^;]+)/i);
          const bg = (bgMatch?.[1] ?? bgFromData ?? "#fef08a").trim();
          const next = `background-color: ${bg}; color: ${HIGHLIGHT_TEXT_COLOR}`;
          return `style="${next}"`;
        },
      );
    } else {
      const bg = (bgFromData ?? "#fef08a").trim();
      attrs = `${attrs} style="background-color: ${bg}; color: ${HIGHLIGHT_TEXT_COLOR}"`;
    }

    return `<mark${attrs}>`;
  });
}

/** Sanitiza HTML para exibição segura. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
  return normalizeHighlightContrast(clean);
}

/** Conteúdo para o editor: HTML sanitizado ou conversão de texto legado. */
export function toEditorHtml(value: string | null | undefined): string {
  if (!value) return "";
  if (looksLikeHtml(value)) return sanitizeRichHtml(value);
  return plainTextToHtml(value);
}
