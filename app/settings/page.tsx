"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveBar, SettingsLoading, SettingsSection, SettingsStack } from "@/components/settings/SettingsSection";
import type { AppConfig } from "@/lib/config";

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

  if (loading) return <SettingsLoading />;

  return (
    <SettingsStack>
      <SettingsSection title="Contact" description="Used on cover letters and resumes.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">{(f) => <Input {...f} value={c.name ?? ""} onChange={(e) => updateCandidate("name", e.target.value)} />}</Field>
          <Field label="Email">{(f) => <Input {...f} type="email" value={c.email ?? ""} onChange={(e) => updateCandidate("email", e.target.value)} />}</Field>
          <Field label="Phone">{(f) => <Input {...f} value={c.phone ?? ""} onChange={(e) => updateCandidate("phone", e.target.value)} />}</Field>
          <Field label="Website">{(f) => <Input {...f} value={c.website ?? ""} onChange={(e) => updateCandidate("website", e.target.value)} />}</Field>
          <Field label="LinkedIn">{(f) => <Input {...f} value={c.linkedin ?? ""} onChange={(e) => updateCandidate("linkedin", e.target.value)} />}</Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Job preferences" description="Filters scraped roles and tunes AI fit scoring.">
        <Field label="Target titles" hint="One per line.">
          {(f) => <Textarea {...f} rows={4} value={(p.titles ?? []).join("\n")} onChange={(e) => updateTitles(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Min salary, FTE ($/yr)">{(f) => <Input {...f} type="number" value={sal.min_fte ?? ""} onChange={(e) => updateSalary("min_fte", Number(e.target.value))} />}</Field>
          <Field label="Min rate, contract ($/hr)">{(f) => <Input {...f} type="number" value={sal.min_contract_hourly ?? ""} onChange={(e) => updateSalary("min_contract_hourly", Number(e.target.value))} />}</Field>
        </div>
        <div className="flex flex-col gap-3">
          <Checkbox label="Open to remote roles" checked={loc.remote ?? true} onCheckedChange={(v) => updateLocation("remote", v)} />
          <Checkbox label="Open to hybrid roles (shows the Local / Hybrid section in the tracker)" checked={loc.hybrid ?? true} onCheckedChange={(v) => updateLocation("hybrid", v)} />
          <Checkbox label="Open to staffing / contract roles (shows the Staffing section in the tracker)" checked={p.open_to_contract ?? true} onCheckedChange={(v) => updatePreference("open_to_contract", v)} />
          <Checkbox label="Hide the Passed / Skipped section (it still prevents duplicate imports)" checked={p.hide_passed ?? false} onCheckedChange={(v) => updatePreference("hide_passed", v)} />
        </div>
      </SettingsSection>

      <SaveBar onSave={save} saving={saving}>Save profile</SaveBar>
    </SettingsStack>
  );
}
