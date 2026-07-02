"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

const INPUT = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1";
const SECTION = "bg-card rounded-xl p-5 space-y-4 shadow-sm";

type Group = "remote" | "local";

interface TargetsData {
  remote: ScrapeTargetConfig[];
  local: ScrapeTargetConfig[];
}

const BLANK: ScrapeTargetConfig = { company: "", url: "", selector: "", linkBase: "" };

interface TargetListProps {
  group: Group;
  label: string;
  list: ScrapeTargetConfig[];
  adding: Group | null;
  draft: ScrapeTargetConfig;
  saving: boolean;
  deleting: string | null;
  onStartAdd: (g: Group) => void;
  onCancelAdd: () => void;
  onSaveNew: () => void;
  onRemove: (g: Group, company: string) => void;
  onDraftChange: (patch: Partial<ScrapeTargetConfig>) => void;
}

function TargetList({
  group, label, list, adding, draft, saving, deleting,
  onStartAdd, onCancelAdd, onSaveNew, onRemove, onDraftChange,
}: TargetListProps) {
  return (
    <div className={SECTION}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">{label}</h2>
        <Button onClick={() => onStartAdd(group)} variant="link" size="sm" className="text-xs">
          + Add target
        </Button>
      </div>

      {list.length === 0 && adding !== group && (
        <p className="text-sm text-muted-foreground">No targets yet. Add one to start scraping.</p>
      )}

      {list.map((t) => {
        const dk = `${group}|${t.company}`;
        return (
          <div key={t.company} className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.company}</p>
              <a href={t.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline truncate block max-w-xs">{t.url}</a>
              {t.selector && <p className="text-xs text-muted-foreground mt-0.5">Selector: <code className="bg-muted px-1 rounded">{t.selector}</code></p>}
            </div>
            <button
              onClick={() => onRemove(group, t.company)}
              disabled={deleting === dk}
              className="text-xs text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-40 transition-colors"
            >
              {deleting === dk ? "…" : "Remove"}
            </button>
          </div>
        );
      })}

      {adding === group && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">New target</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL}>Company <span className="text-destructive">*</span></label>
              <input className={INPUT} placeholder="Acme Corp" value={draft.company} onChange={(e) => onDraftChange({ company: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Career page URL <span className="text-destructive">*</span></label>
              <input className={INPUT} placeholder="https://careers.acme.com/jobs?q=designer" value={draft.url} onChange={(e) => onDraftChange({ url: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>CSS selector (optional)</label>
              <input className={INPUT} placeholder=".job-title a" value={draft.selector ?? ""} onChange={(e) => onDraftChange({ selector: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Link base (optional)</label>
              <input className={INPUT} placeholder="https://careers.acme.com" value={draft.linkBase ?? ""} onChange={(e) => onDraftChange({ linkBase: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={onCancelAdd} variant="outline" size="sm">Cancel</Button>
            <Button onClick={onSaveNew} loading={saving} size="sm">
              Add target
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  function startAdd(group: Group) { setAdding(group); setDraft(BLANK); }
  function cancelAdd() { setAdding(null); }
  function patchDraft(patch: Partial<ScrapeTargetConfig>) { setDraft((d) => ({ ...d, ...patch })); }

  async function saveNew() {
    if (!draft.company || !draft.url) { toast.error("Company and URL are required"); return; }
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

  if (loading) return <div className="text-sm text-muted-foreground py-8">Loading…</div>;

  const shared = { adding, draft, saving, deleting, onStartAdd: startAdd, onCancelAdd: cancelAdd, onSaveNew: saveNew, onRemove: remove, onDraftChange: patchDraft };

  return (
    <div className="space-y-6">
      <TargetList group="remote" label="Remote / National" list={targets.remote} {...shared} />
      <TargetList group="local" label="Local / Hybrid" list={targets.local} {...shared} />
    </div>
  );
}
