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
  return html;
}

/** Sanitiza HTML para exibição segura. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

/** Conteúdo para o editor: HTML sanitizado ou conversão de texto legado. */
export function toEditorHtml(value: string | null | undefined): string {
  if (!value) return "";
  if (looksLikeHtml(value)) return sanitizeRichHtml(value);
  return plainTextToHtml(value);
}
