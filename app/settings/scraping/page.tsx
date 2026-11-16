"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Code, SaveBar, SettingsLoading, SettingsSection, SettingsStack } from "@/components/settings/SettingsSection";
import type { AppConfig } from "@/lib/config";

const SCHEDULE_PRESETS = [
  { label: "Weekdays at 8am", value: "0 8 * * 1-5" },
  { label: "Daily at 9am", value: "0 9 * * *" },
  { label: "Twice daily (9am + 5pm)", value: "0 9,17 * * 1-5" },
  { label: "Custom", value: "custom" },
];

export default function ScrapingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppConfig>({});

  const loc = config.preferences?.locations ?? {};
  const schedule = config.scraping?.schedule ?? "0 8 * * 1-5";
  const presetMatch = SCHEDULE_PRESETS.find((p) => p.value === schedule && p.value !== "custom");
  const [scheduleMode, setScheduleMode] = useState<string>(presetMatch ? schedule : "custom");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig) => {
        setConfig(data);
        const s = data.scraping?.schedule ?? "0 8 * * 1-5";
        const match = SCHEDULE_PRESETS.find((p) => p.value === s && p.value !== "custom");
        setScheduleMode(match ? s : "custom");
        setLoading(false);
      })
      .catch(() => { toast.error("Failed to load config"); setLoading(false); });
  }, []);

  function updateLocation(key: string, value: string | number) {
    setConfig((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        locations: { ...prev.preferences?.locations, [key]: value },
      },
    }));
  }

  function updateSchedule(value: string) {
    setConfig((prev) => ({
      ...prev,
      scraping: { ...prev.scraping, schedule: value },
    }));
  }

  function handlePresetChange(preset: string) {
    setScheduleMode(preset);
    if (preset !== "custom") updateSchedule(preset);
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
      toast.success("Scraping settings saved");
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SettingsLoading />;

  return (
    <SettingsStack>
      <SettingsSection title="Local hub" description="Used to qualify hybrid roles. The scraper checks if a listing's location matches your hub city or state.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Hub city">{(f) => <Input {...f} placeholder="e.g. St. Louis" value={loc.hub_city ?? ""} onChange={(e) => updateLocation("hub_city", e.target.value)} />}</Field>
          <Field label="State">{(f) => <Input {...f} placeholder="MO" maxLength={2} value={loc.hub_state ?? ""} onChange={(e) => updateLocation("hub_state", e.target.value.toUpperCase())} />}</Field>
          <Field label="ZIP">{(f) => <Input {...f} placeholder="00000" maxLength={10} value={loc.hub_zip ?? ""} onChange={(e) => updateLocation("hub_zip", e.target.value)} />}</Field>
        </div>
        <Field label="Hybrid radius (miles)" className="max-w-xs">
          {(f) => <Input {...f} type="number" value={loc.hub_radius_miles ?? 25} onChange={(e) => updateLocation("hub_radius_miles", Number(e.target.value))} />}
        </Field>
      </SettingsSection>

      <SettingsSection title="Scrape schedule" description="Used by the GitHub Actions workflow to run automated scrapes. Cron syntax, UTC.">
        <RadioGroup aria-label="Scrape schedule" value={scheduleMode} onValueChange={(v) => handlePresetChange(String(v))}>
          {SCHEDULE_PRESETS.map((preset) => (
            <RadioItem key={preset.value} value={preset.value} label={preset.label} description={preset.value !== "custom" ? preset.value : undefined} />
          ))}
        </RadioGroup>
        {scheduleMode === "custom" && (
          <Field label="Cron expression" hint="Five fields: minute, hour, day of month, month, weekday.">
            {(f) => <Input {...f} className="font-mono" placeholder="0 8 * * 1-5" value={schedule} onChange={(e) => updateSchedule(e.target.value)} />}
          </Field>
        )}
        <p className="text-xs text-muted-foreground">Example: <Code>0 8 * * 1-5</Code> runs weekdays at 8:00 UTC.</p>
      </SettingsSection>

      <SaveBar onSave={save} saving={saving}>Save scraping settings</SaveBar>
    </SettingsStack>
  );
}
