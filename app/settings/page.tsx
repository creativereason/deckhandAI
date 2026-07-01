"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppConfig } from "@/lib/config";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppConfig>({});

  const c = config.candidate ?? {};
  const p = config.preferences ?? {};
  const loc = p.locations ?? {};
  const sal = p.salary ?? {};

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => { setConfig(data); setLoading(false); })
      .catch(() => { toast.error("Failed to load config"); setLoading(false); });
  }, []);

  function updateCandidate(key: string, value: string) {
    setConfig((prev) => ({ ...prev, candidate: { ...prev.candidate, [key]: value } }));
  }

  function updateLocation(key: string, value: string | boolean | number) {
    setConfig((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        locations: { ...prev.preferences?.locations, [key]: value },
      },
    }));
  }

  function updatePreference(key: string, value: boolean) {
    setConfig((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value },
    }));
  }

  function updateSalary(key: string, value: number) {
    setConfig((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        salary: { ...prev.preferences?.salary, [key]: value },
      },
    }));
  }

  function updateTitles(raw: string) {
    const titles = raw.split("\n").map((t) => t.trim()).filter(Boolean);
    setConfig((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, titles },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Profile saved");
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-p-dusk dark:text-gray-400 py-8">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Contact
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={LABEL}>Name</label>
            <input className={INPUT} value={c.name ?? ""} onChange={(e) => updateCandidate("name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input type="email" className={INPUT} value={c.email ?? ""} onChange={(e) => updateCandidate("email", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Phone</label>
            <input className={INPUT} value={c.phone ?? ""} onChange={(e) => updateCandidate("phone", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Website</label>
            <input className={INPUT} value={c.website ?? ""} onChange={(e) => updateCandidate("website", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>LinkedIn</label>
            <input className={INPUT} value={c.linkedin ?? ""} onChange={(e) => updateCandidate("linkedin", e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Job Preferences
        </h2>
        <div>
          <label className={LABEL}>Target titles (one per line)</label>
          <textarea
            rows={4}
            className={INPUT}
            value={(p.titles ?? []).join("\n")}
            onChange={(e) => updateTitles(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Min salary — FTE ($/yr)</label>
            <input
              type="number"
              className={INPUT}
              value={sal.min_fte ?? ""}
              onChange={(e) => updateSalary("min_fte", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={LABEL}>Min rate — Contract ($/hr)</label>
            <input
              type="number"
              className={INPUT}
              value={sal.min_contract_hourly ?? ""}
              onChange={(e) => updateSalary("min_contract_hourly", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="remote"
            type="checkbox"
            className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv"
            checked={loc.remote ?? true}
            onChange={(e) => updateLocation("remote", e.target.checked)}
          />
          <label htmlFor="remote" className="text-sm text-gray-700 dark:text-gray-300">
            Open to remote roles
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="hybrid"
            type="checkbox"
            className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv"
            checked={loc.hybrid ?? true}
            onChange={(e) => updateLocation("hybrid", e.target.checked)}
          />
          <label htmlFor="hybrid" className="text-sm text-gray-700 dark:text-gray-300">
            Open to hybrid roles — shows the Local / Hybrid section in the tracker
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="contract"
            type="checkbox"
            className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv"
            checked={p.open_to_contract ?? true}
            onChange={(e) => updatePreference("open_to_contract", e.target.checked)}
          />
          <label htmlFor="contract" className="text-sm text-gray-700 dark:text-gray-300">
            Open to staffing / contract roles — shows the Staffing section in the tracker
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="hide_passed"
            type="checkbox"
            className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv"
            checked={p.hide_passed ?? false}
            onChange={(e) => updatePreference("hide_passed", e.target.checked)}
          />
          <label htmlFor="hide_passed" className="text-sm text-gray-700 dark:text-gray-300">
            Hide the Passed / Skipped section — it will still be used to prevent duplicate imports
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} size="lg" className="px-6">
          Save profile
        </Button>
      </div>
    </div>
  );
}
