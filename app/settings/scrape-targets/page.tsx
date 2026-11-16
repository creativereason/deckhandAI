"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/states";
import { Code, SettingsLoading, SettingsSection, SettingsStack } from "@/components/settings/SettingsSection";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

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
    <SettingsSection
      title={label}
      actions={<Button onClick={() => onStartAdd(group)} variant="outline" size="sm"><Plus aria-hidden />Add target</Button>}
    >
      {list.length === 0 && adding !== group && (
        <Card variant="muted" padding="none"><EmptyState compact title="No targets yet" description="Add a career page to start scraping it." /></Card>
      )}

      {list.length > 0 && (
        <ListGroup>
          {list.map((t) => {
            const dk = `${group}|${t.company}`;
            return (
              <ListRow
                key={t.company}
                title={t.company}
                actions={<Button onClick={() => onRemove(group, t.company)} disabled={deleting === dk} loading={deleting === dk} variant="ghost" size="sm" aria-label={`Remove ${t.company}`}>Remove</Button>}
              >
                <a href={t.url} target="_blank" rel="noreferrer" className="block max-w-xs truncate text-xs text-muted-foreground underline-offset-4 hover:underline">{t.url}<span className="sr-only"> (opens in a new tab)</span></a>
                {t.selector && <p className="text-xs text-muted-foreground">Selector: <Code>{t.selector}</Code></p>}
              </ListRow>
            );
          })}
        </ListGroup>
      )}

      {adding === group && (
        <Card variant="muted" className="gap-4">
          <h3 className="text-base font-semibold">New target</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" required className="sm:col-span-2">{(f) => <Input {...f} placeholder="Acme Corp" value={draft.company} onChange={(e) => onDraftChange({ company: e.target.value })} />}</Field>
            <Field label="Career page URL" required className="sm:col-span-2">{(f) => <Input {...f} placeholder="https://careers.acme.com/jobs?q=designer" value={draft.url} onChange={(e) => onDraftChange({ url: e.target.value })} />}</Field>
            <Field label="CSS selector" optional>{(f) => <Input {...f} placeholder=".job-title a" value={draft.selector ?? ""} onChange={(e) => onDraftChange({ selector: e.target.value })} />}</Field>
            <Field label="Link base" optional>{(f) => <Input {...f} placeholder="https://careers.acme.com" value={draft.linkBase ?? ""} onChange={(e) => onDraftChange({ linkBase: e.target.value })} />}</Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={onCancelAdd} variant="ghost">Cancel</Button>
            <Button onClick={onSaveNew} loading={saving}>Add target</Button>
          </div>
        </Card>
      )}
    </SettingsSection>
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

  if (loading) return <SettingsLoading />;

  const shared = { adding, draft, saving, deleting, onStartAdd: startAdd, onCancelAdd: cancelAdd, onSaveNew: saveNew, onRemove: remove, onDraftChange: patchDraft };

  return (
    <SettingsStack>
      <TargetList group="remote" label="Remote / National" list={targets.remote} {...shared} />
      <TargetList group="local" label="Local / Hybrid" list={targets.local} {...shared} />
    </SettingsStack>
  );
}
