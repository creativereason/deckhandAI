"use client";
import { useState } from "react";

interface ScrapeLogEntry {
  company: string;
  status: "ok" | "error";
  listings: number;
  qualifying: number;
  added: number;
  error?: string;
  selector?: string;
}

interface Props {
  onDone: () => void;
}

function formatLogEntry(entry: ScrapeLogEntry): string {
  if (entry.status === "error") {
    return `${entry.company}: failed — ${entry.error}`;
  }
  const parts = [
    `${entry.listings} listing${entry.listings !== 1 ? "s" : ""}`,
    `${entry.qualifying} qualifying (local)`,
    `${entry.added} new`,
  ];
  const selector = entry.selector ? ` via ${entry.selector}` : "";
  return `${entry.company}: ${parts.join(", ")}${selector}`;
}

export default function GenericScrapePanel({ onDone }: Props) {
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [linkBase, setLinkBase] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ added: number; log?: ScrapeLogEntry[] } | { error: string } | null>(
    null
  );

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/scrape/generic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          url,
          selector: selector || undefined,
          linkBase: linkBase || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? `Scrape failed (${res.status})` });
        return;
      }
      setResult(data);
      if (data.added > 0) onDone();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-p-linen/40 dark:bg-p-dark-mid/60 w-full max-w-md">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest hover:text-p-blue dark:hover:text-gray-200 w-full text-left"
      >
        {expanded ? "▼" : "▶"} Scrape local jobs from URL
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Paste a career page URL. Matches senior UX/design roles in the St. Louis metro and adds them to Local.
          </p>
          <input
            className="w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-p-dark-mid dark:text-white dark:placeholder-gray-600"
            placeholder="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={running}
          />
          <input
            className="w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-p-dark-mid dark:text-white dark:placeholder-gray-600"
            placeholder="https://careers.example.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
          />
          <input
            className="w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-p-dark-mid dark:text-white dark:placeholder-gray-600"
            placeholder="CSS selector (optional, auto-detect if blank)"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            disabled={running}
          />
          <input
            className="w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-p-dark-mid dark:text-white dark:placeholder-gray-600"
            placeholder="Link base for relative URLs (optional)"
            value={linkBase}
            onChange={(e) => setLinkBase(e.target.value)}
            disabled={running}
          />
          <button
            onClick={run}
            disabled={running || !company.trim() || !url.trim()}
            className="w-full bg-teal-700 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-teal-800 disabled:opacity-50"
          >
            {running ? "Scraping…" : "Scrape to Local"}
          </button>

          {running && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Checking page for local design roles…</p>
          )}
          {result && "error" in result && (
            <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>
          )}
          {result && "added" in result && (
            <div className="text-xs space-y-0.5">
              <p className={result.added > 0 ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}>
                {result.added > 0
                  ? `${result.added} new local job${result.added !== 1 ? "s" : ""} added`
                  : "No new local qualifying jobs found."}
              </p>
              {result.log?.map((entry) => (
                <p key={entry.company} className={entry.status === "error" ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}>
                  {formatLogEntry(entry)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
