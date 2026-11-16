import { Fragment } from "react";

// Lightweight markdown renderer — handles the subset the AI chat produces:
// headings, bold/italic/code, bullet/numbered lists, code fences, horizontal rules.
// No external dependencies.

function parseInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Patterns: markdown link, code, bold-italic, bold, italic
  const re = /(\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)|`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("[")) {
      // [label](url)
      const isExternal = m[3].startsWith("http");
      out.push(
        <a key={m.index} href={m[3]} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined}
          className="underline text-primary hover:opacity-75 break-all">
          {m[2]}
        </a>
      );
    } else if (tok.startsWith("`")) {
      out.push(<code key={m.index} className="rounded-sm bg-muted px-1 font-mono text-xs">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("***")) {
      out.push(<strong key={m.index}><em>{tok.slice(3, -3)}</em></strong>);
    } else if (tok.startsWith("**")) {
      out.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={m.index}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function InlineParsed({ text }: { text: string }) {
  return <>{parseInline(text)}</>;
}

// Collects consecutive list-item lines matching itemPattern, tolerating a
// single blank line between items — LLMs commonly emit "loose" lists with
// blank-line spacing, and treating that as list-end would split one list
// into several single-item lists (each <ol> restarting its own count at 1).
function collectListItems(
  lines: string[],
  startIndex: number,
  itemPattern: RegExp,
  stripPattern: RegExp
): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    if (itemPattern.test(lines[i])) {
      items.push(lines[i].replace(stripPattern, ""));
      i++;
    } else if (lines[i].trim() === "" && i + 1 < lines.length && itemPattern.test(lines[i + 1])) {
      i++; // blank line between items — keep the list going
    } else {
      break;
    }
  }
  return { items, nextIndex: i };
}

interface Props {
  text: string;
  className?: string;
}

export function MarkdownContent({ text, className }: Props) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith("```")) {
      // Language tag is intentionally ignored — all code blocks render the same
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing ```
      nodes.push(
        <pre key={key++} className="my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key++} className="my-2 border-border" />);
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1
        ? "mt-3 mb-1 text-base font-semibold text-foreground"
        : level === 2
        ? "mt-2 mb-1 text-sm font-semibold text-foreground"
        : "mt-2 mb-1 text-sm font-medium text-foreground";
      const Tag = (`h${level + 2}`) as "h3" | "h4" | "h5";
      nodes.push(<Tag key={key++} className={cls}><InlineParsed text={hMatch[2]} /></Tag>);
      i++;
      continue;
    }

    // Pipe table — a header row, a separator row of only -, :, |, and
    // whitespace, then one or more body rows, all starting with "|".
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
      const splitRow = (row: string) =>
        row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

      const headerCells = splitRow(line);
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        bodyRows.push(splitRow(lines[i]));
        i++;
      }
      nodes.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                {headerCells.map((cell, idx) => (
                  <th key={idx} className="text-left font-semibold px-2 py-1 border-b border-border whitespace-nowrap">
                    <InlineParsed text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2 py-1 border-b border-border align-top">
                      <InlineParsed text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const { items, nextIndex } = collectListItems(lines, i, /^[-*]\s/, /^[-*]\s+/);
      i = nextIndex;
      nodes.push(
        <ul key={key++} className="my-2 ml-4 flex list-disc flex-col gap-1">
          {items.map((it, idx) => (
            <li key={idx} className="text-sm leading-relaxed">
              <InlineParsed text={it} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const { items, nextIndex } = collectListItems(lines, i, /^\d+\.\s/, /^\d+\.\s+/);
      i = nextIndex;
      nodes.push(
        <ol key={key++} className="my-2 ml-4 flex list-decimal flex-col gap-1">
          {items.map((it, idx) => (
            <li key={idx} className="text-sm leading-relaxed">
              <InlineParsed text={it} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      // Avoid double spacing: only insert gap if there's more content coming
      if (i < lines.length && lines[i].trim() !== "") {
        nodes.push(<div key={key++} className="h-1.5" />);
      }
      continue;
    }

    // Paragraph / plain text
    nodes.push(
      <p key={key++} className="text-sm leading-relaxed break-words">
        <InlineParsed text={line} />
      </p>
    );
    i++;
  }

  return <div className={className}>{nodes}</div>;
}
