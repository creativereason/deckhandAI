"use client";
import { useEffect, useState } from "react";
import { ScrapeGroup } from "@/lib/scrape-targets";

interface ScrapeLogEntry {
  company: string;
  status: "ok" | "error";
  listings: number;
  qualifying: number;
  added: number;
  error?: string;
  selector?: string;
}

interface ScrapeResult {
  added: number;
  jobs?: { company: string; role: string }[];
  log?: ScrapeLogEntry[];
  group?: ScrapeGroup;
}

interface GroupOption {
  group: ScrapeGroup;
  label: string;
  companies: string[];
}

interface Props {
  onDone: () => void;
}

function formatLogEntry(entry: ScrapeLogEntry): string {
  if (entry.status === "error") return `${entry.company}: failed — ${entry.error}`;
  return `${entry.company}: ${entry.listings} listings, ${entry.qualifying} qualifying, ${entry.added} new`;
}

export default function ScrapePanel({ onDone }: Props) {
  const [group, setGroup] = useState<ScrapeGroup>("local");
  const [company, setCompany] = useState("All");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScrapeResult | { error: string } | null>(null);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([
    { group: "remote", label: "Remote / National", companies: ["All"] },
    { group: "local", label: "Local / Hybrid", companies: ["All"] },
  ]);

  useEffect(() => {
    fetch("/api/scrape-targets")
      .then((r) => r.json())
      .then((data: { remote: { company: string }[]; local: { company: string }[] }) => {
        setGroupOptions([
          { group: "remote", label: "Remote / National", companies: ["All", ...data.remote.map((t) => t.company)] },
          { group: "local", label: "Local / Hybrid", companies: ["All", ...data.local.map((t) => t.company)] },
        ]);
      })
      .catch(() => {});
  }, []);

  const groupConfig = groupOptions.find((g) => g.group === group)!;

  function onGroupChange(next: ScrapeGroup) {
    setGroup(next);
    setCompany("All");
    setResult(null);
  }

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, company: company === "All" ? undefined : company }),
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

  const targets = company === "All" ? groupConfig.companies.slice(1).join(", ") || "all" : company;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <select
          className="border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
          value={group}
          onChange={(e) => onGroupChange(e.target.value as ScrapeGroup)}
          disabled={running}
        >
          <option value="local">Local / Hybrid</option>
          <option value="remote">Remote / National</option>
        </select>
        <select
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 max-w-[160px]"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={running}
        >
          {groupConfig.companies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={running}
          className="bg-indigo-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {running ? `Scraping ${targets}…` : "Scrape"}
        </button>
      </div>

      {running && (
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm text-right">
          Checking {group === "local" ? "local metro" : "national"} career pages. Usually 30–90 seconds.
        </p>
      )}

      {result && "error" in result && (
        <p className="text-sm text-red-600 max-w-md text-right">{result.error}</p>
      )}

      {result && "added" in result && (
        <div className="text-right max-w-md space-y-1">
          <p className={`text-sm ${result.added > 0 ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
            {result.added > 0
              ? `${result.added} new job${result.added !== 1 ? "s" : ""} added to review queue`
              : "Scrape complete. No new qualifying jobs found."}
          </p>
          {result.log && result.log.length > 0 && (
            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
              {result.log.map((entry) => (
                <li key={entry.company} className={entry.status === "error" ? "text-red-600" : undefined}>
                  {formatLogEntry(entry)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
