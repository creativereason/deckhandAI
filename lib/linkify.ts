export type LinkPart = { type: "text"; text: string } | { type: "link"; text: string; href: string };

// Markdown link first so its URL is not matched again as a bare URL. Only http(s) is linkable:
// notes can hold text from outside sources, so other schemes (javascript:) stay plain text.
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"]+$/;

export function linkify(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [raw, label, markdownHref] = match;
    const url = markdownHref ? raw : raw.replace(TRAILING_PUNCTUATION, "");
    if (match.index > last) parts.push({ type: "text", text: text.slice(last, match.index) });
    parts.push({ type: "link", text: label ?? url, href: markdownHref ?? url });
    last = match.index + url.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}
