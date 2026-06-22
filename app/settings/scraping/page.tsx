"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppConfig } from "@/lib/config";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";

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

  if (loading) {
    return <div className="text-sm text-p-dusk dark:text-gray-400 py-8">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Local hub
        </h2>
        <p className="text-xs text-p-dusk dark:text-gray-400">
          Used to qualify hybrid roles. The scraper checks if a listing&apos;s location matches
          your hub city or state.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className={LABEL}>Hub city</label>
            <input
              className={INPUT}
              placeholder="e.g. St. Louis"
              value={loc.hub_city ?? ""}
              onChange={(e) => updateLocation("hub_city", e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>State</label>
            <input
              className={INPUT}
              placeholder="MO"
              maxLength={2}
              value={loc.hub_state ?? ""}
              onChange={(e) => updateLocation("hub_state", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className={LABEL}>ZIP</label>
            <input
              className={INPUT}
              placeholder="00000"
              maxLength={10}
              value={loc.hub_zip ?? ""}
              onChange={(e) => updateLocation("hub_zip", e.target.value)}
            />
          </div>
        </div>
        <div className="max-w-xs">
          <label className={LABEL}>Hybrid radius (miles)</label>
          <input
            type="number"
            className={INPUT}
            value={loc.hub_radius_miles ?? 25}
            onChange={(e) => updateLocation("hub_radius_miles", Number(e.target.value))}
          />
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Scrape schedule
        </h2>
        <p className="text-xs text-p-dusk dark:text-gray-400">
          Used by the GitHub Actions workflow to run automated scrapes. Cron syntax, UTC.
        </p>
        <div className="space-y-3">
          {SCHEDULE_PRESETS.map((preset) => (
            <label key={preset.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="schedule"
                value={preset.value}
                checked={scheduleMode === preset.value}
                onChange={() => handlePresetChange(preset.value)}
                className="accent-p-accent dark:accent-p-accent-inv"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{preset.label}</span>
              {preset.value !== "custom" && (
                <code className="text-xs text-p-dusk dark:text-gray-400 bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded">
                  {preset.value}
                </code>
              )}
            </label>
          ))}
        </div>
        {scheduleMode === "custom" && (
          <div>
            <label className={LABEL}>Cron expression</label>
            <input
              className={INPUT}
              placeholder="0 8 * * 1-5"
              value={schedule}
              onChange={(e) => updateSchedule(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-6 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save scraping settings"}
        </button>
      </div>
    </div>
  );
}
