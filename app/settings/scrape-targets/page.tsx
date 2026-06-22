"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";

type Group = "remote" | "local";

interface TargetsData {
  remote: ScrapeTargetConfig[];
  local: ScrapeTargetConfig[];
}

const BLANK: ScrapeTargetConfig = {
  company: "",
  url: "",
  selector: "",
  linkBase: "",
};

export default function ScrapeTargetsSettings() {
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetsData>({ remote: [], local: [] });
  const [adding, setAdding] = useState<Group | null>(null);
  const [draft, setDraft] = useState<ScrapeTargetConfig>(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scrape-targets")
      .then((r) => r.json())
      .then((data) => { setTargets(data); setLoading(false); })
      .catch(() => { toast.error("Failed to load scrape targets"); setLoading(false); });
  }, []);

  function startAdd(group: Group) {
    setAdding(group);
    setDraft(BLANK);
  }

  async function saveNew() {
    if (!draft.company || !draft.url) {
      toast.error("Company and URL are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/scrape-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: adding, target: draft }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTargets((prev) => ({ ...prev, [adding!]: [...prev[adding!], draft] }));
      setAdding(null);
      toast.success(`Added ${draft.company}`);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(group: Group, company: string) {
    setDeleting(`${group}|${company}`);
    try {
      const res = await fetch("/api/scrape-targets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, company }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTargets((prev) => ({ ...prev, [group]: prev[group].filter((t) => t.company !== company) }));
      toast.success(`Removed ${company}`);
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <div className="text-sm text-p-dusk dark:text-gray-400 py-8">Loading…</div>;

  function TargetList({ group, label }: { group: Group; label: string }) {
    const list = targets[group];
    return (
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">{label}</h2>
          <button
            onClick={() => startAdd(group)}
            className="text-xs text-p-accent dark:text-p-accent-inv hover:underline"
          >
            + Add target
          </button>
        </div>

        {list.length === 0 && adding !== group && (
          <p className="text-sm text-p-dusk dark:text-gray-400">No targets yet. Add one to start scraping.</p>
        )}

        {list.map((t) => {
          const dk = `${group}|${t.company}`;
          return (
            <div key={t.company} className="flex items-start justify-between gap-4 py-2 border-b border-p-linen dark:border-p-dark-mid last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.company}</p>
                <a href={t.url} target="_blank" rel="noreferrer" className="text-xs text-p-dusk dark:text-gray-400 hover:underline truncate block max-w-xs">{t.url}</a>
                {t.selector && <p className="text-xs text-p-dusk dark:text-gray-500 mt-0.5">Selector: <code className="bg-p-linen dark:bg-p-dark-mid px-1 rounded">{t.selector}</code></p>}
              </div>
              <button
                onClick={() => remove(group, t.company)}
                disabled={deleting === dk}
                className="text-xs text-p-dusk dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 disabled:opacity-40 transition-colors"
              >
                {deleting === dk ? "…" : "Remove"}
              </button>
            </div>
          );
        })}

        {adding === group && (
          <div className="border border-p-linen dark:border-p-dark-mid rounded-xl p-4 space-y-3 bg-p-light dark:bg-p-dark-mid">
            <p className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">New target</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className={LABEL}>Company <span className="text-red-400">*</span></label>
                <input className={INPUT} placeholder="Acme Corp" value={draft.company} onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Career page URL <span className="text-red-400">*</span></label>
                <input className={INPUT} placeholder="https://careers.acme.com/jobs?q=designer" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>CSS selector (optional)</label>
                <input className={INPUT} placeholder=".job-title a" value={draft.selector ?? ""} onChange={(e) => setDraft((d) => ({ ...d, selector: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>Link base (optional)</label>
                <input className={INPUT} placeholder="https://careers.acme.com" value={draft.linkBase ?? ""} onChange={(e) => setDraft((d) => ({ ...d, linkBase: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(null)} className="text-sm text-p-dusk dark:text-gray-400 px-3 py-1.5 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancel</button>
              <button
                onClick={saveNew}
                disabled={saving}
                className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Add target"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TargetList group="remote" label="Remote / National" />
      <TargetList group="local" label="Local / Hybrid" />
    </div>
  );
}
