#!/usr/bin/env node
// WCAG contrast check for every text/background and control-outline token pair, light and dark.
// Parses app/globals.css so the doc can never drift from the tokens. Exit 1 on any failure.
import { readFileSync } from "fs";
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const block = (sel) => {
  const start = css.indexOf(`${sel} {`);
  return css.slice(start, css.indexOf("\n}", start));
};
const parse = (b) => Object.fromEntries([...b.matchAll(/--([a-z-]+):\s*oklch\(([^)]+)\)/g)].map(([, k, v]) => [k, v]));
const themes = { light: parse(block(":root")), dark: parse(block(".dark")) };

function toRGB(spec) {
  const [l, c, h, a] = spec.replace("/", " ").split(/\s+/).map(Number);
  const hr = (h * Math.PI) / 180, A = c * Math.cos(hr), B = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B, m_ = l - 0.1055613458 * A - 0.0638541728 * B, s_ = l - 0.0894841775 * A - 1.291485548 * B;
  const [L, M, S] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
  return lin.map((x) => Math.min(1, Math.max(0, x)));
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const ratio = (a, b) => { const [x, y] = [lum(toRGB(a)), lum(toRGB(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground token, background token, min ratio, what]
const PAIRS = [
  ["foreground", "background", 4.5, "body on canvas"], ["card-foreground", "card", 4.5, "text on card"],
  ["muted-foreground", "background", 4.5, "secondary text on canvas"], ["muted-foreground", "card", 4.5, "secondary text on card"], ["muted-foreground", "muted", 4.5, "secondary text on muted"],
  ["popover-foreground", "popover", 4.5, "menu text"],
  ["primary-foreground", "primary", 4.5, "primary button"], ["primary", "background", 4.5, "link text on canvas"], ["primary", "card", 4.5, "link text on card"],
  ["primary-subtle-foreground", "primary-subtle", 4.5, "info badge"], ["secondary-foreground", "secondary", 4.5, "secondary button"],
  ["accent-foreground", "accent", 4.5, "hover row"],
  ["ai-foreground", "ai", 4.5, "AI button"], ["ai-subtle-foreground", "ai-subtle", 4.5, "AI callout"], ["ai", "card", 3, "AI icon on card"],
  ["success-foreground", "success", 4.5, "success solid"], ["success-subtle-foreground", "success-subtle", 4.5, "success badge"],
  ["warning-foreground", "warning", 4.5, "warning solid"], ["warning-subtle-foreground", "warning-subtle", 4.5, "warning badge"],
  ["destructive-foreground", "destructive", 4.5, "danger solid"], ["destructive-subtle-foreground", "destructive-subtle", 4.5, "danger badge"], ["destructive", "card", 4.5, "error text on card"],
  ["input", "card", 3, "control outline vs card (1.4.11)"], ["ring", "background", 3, "focus ring vs canvas"], ["ring", "card", 3, "focus ring vs card"],
];
let failed = 0;
for (const [theme, t] of Object.entries(themes)) {
  for (const [fg, bg, min, what] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    if (!ok || process.env.VERBOSE) console.log(`${ok ? "pass" : "FAIL"} ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)} (min ${min}) ${fg} on ${bg} — ${what}`);
  }
}
console.log(failed ? `\n${failed} failing pair(s)` : "all token pairs pass WCAG AA");
process.exit(failed ? 1 : 0);
