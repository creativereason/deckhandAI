#!/usr/bin/env node
// Rejects hard-coded styling in screen and component code. This is the Phase 3 grep, runnable any time.
//   node redesign/tools/check-tokens.mjs          -> list violations, exit 1 if any
//   node redesign/tools/check-tokens.mjs --count  -> only per-rule counts
// Justified exceptions go in ALLOW below with the reason, mirrored in redesign/DECISIONS.md.
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;
const RULES = [
  ["raw palette color", /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration)-(?:red|blue|green|amber|yellow|slate|gray|zinc|orange|purple|pink|emerald|teal|sky|indigo|violet|rose|neutral|stone|lime|cyan|fuchsia|black|white)(?:-\d{2,3})?\b/],
  ["hex/rgb/hsl literal", /#[0-9a-fA-F]{3,8}\b(?![^<]*<\/)|\brgba?\(|\bhsla?\(/],
  ["arbitrary px/rem value", /\[-?[0-9.]+(?:px|rem|em)\]/],
  ["half-step spacing", /\b(?:-?m[trblxy]?|p[trblxy]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|left|right|bottom)-(?:0\.5|1\.5|2\.5|3\.5)\b/],
  ["bold weight (use semibold)", /\bfont-(?:bold|extrabold|black|light|thin)\b/],
  ["off-scale text size", /\btext-(?:3xl|4xl|5xl|6xl|\[[^\]]+\])\b/],
  ["inline style", /style=\{\{/],
  ["legacy tone-* class", /\b(?:bg|text|border)-tone-[a-z]+/],
  ["emoji as icon", /[\u{1F300}-\u{1FAFF}\u{2B50}\u{26A1}]/u],
];
// file -> [rule names] allowed, with the reason.
const ALLOW = {
  "components/ui/nav.tsx": { "inline style": "grid column count depends on the number of nav items" },
  "lib/job-signal.ts": {},
};

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === "__tests__" || f === "node_modules" || f.startsWith(".")) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(f) && !p.includes("app/styleguide")) files.push(p);
  }
})(join(ROOT, "app")), (() => walk2(join(ROOT, "components")))();
function walk2(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === "__tests__") continue;
    if (statSync(p).isDirectory()) walk2(p);
    else if (/\.tsx$/.test(f)) files.push(p);
  }
}

const counts = Object.fromEntries(RULES.map(([n]) => [n, 0]));
const lines = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const [name, re] of RULES) {
      if (ALLOW[rel]?.[name]) continue;
      if (re.test(line)) { counts[name]++; lines.push(`${rel}:${i + 1}  [${name}]  ${line.trim().slice(0, 110)}`); }
    }
  });
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (!process.argv.includes("--count")) console.log(lines.join("\n"));
console.log("\n" + Object.entries(counts).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join("\n"));
console.log(`\n${total} violation(s) in ${files.length} files`);
process.exit(total ? 1 : 0);
