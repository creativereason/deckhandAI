import { Fragment } from "react";

// Lightweight markdown renderer — handles the subset the AI chat produces:
// headings, bold/italic/code, bullet/numbered lists, code fences, horizontal rules.
// No external dependencies.

function parseInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Patterns: code `...`, bold **...**, italic *...*, bold-italic ***...***
  const re = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(<code key={m.index} className="px-1 py-0.5 rounded bg-stone-100 dark:bg-white/10 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
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
      const lang = line.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing ```
      nodes.push(
        <pre key={key++} className="my-2 p-3 rounded-lg bg-stone-100 dark:bg-white/10 overflow-x-auto text-xs font-mono leading-relaxed">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key++} className="my-2 border-stone-200 dark:border-white/20" />);
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1
        ? "text-base font-bold mt-3 mb-1 text-gray-900 dark:text-white"
        : level === 2
        ? "text-sm font-bold mt-2.5 mb-1 text-gray-800 dark:text-gray-100"
        : "text-sm font-semibold mt-2 mb-0.5 text-gray-700 dark:text-gray-200";
      const Tag = (`h${level}`) as "h1" | "h2" | "h3";
      nodes.push(<Tag key={key++} className={cls}><InlineParsed text={hMatch[2]} /></Tag>);
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={key++} className="my-1.5 ml-4 space-y-0.5 list-disc list-outside">
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
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol key={key++} className="my-1.5 ml-4 space-y-0.5 list-decimal list-outside">
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
      <p key={key++} className="text-sm leading-relaxed">
        <InlineParsed text={line} />
      </p>
    );
    i++;
  }

  return <div className={className}>{nodes}</div>;
}
