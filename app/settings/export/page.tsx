"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppConfig, ExportStyle } from "@/lib/config";
import { DEFAULT_EXPORT_STYLE } from "@/lib/config";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";

export default function ExportSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppConfig>({});

  const style: ExportStyle = config.export ?? {};

  function get<K extends keyof ExportStyle>(key: K): ExportStyle[K] {
    return style[key] ?? DEFAULT_EXPORT_STYLE[key];
  }

  function updateExport(key: keyof ExportStyle, value: ExportStyle[typeof key]) {
    setConfig((prev) => ({ ...prev, export: { ...prev.export, [key]: value } }));
  }

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AppConfig) => { setConfig(data); setLoading(false); })
      .catch(() => { toast.error("Failed to load config"); setLoading(false); });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Export settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Document style</h2>
        <p className="text-xs text-p-dusk dark:text-gray-400 -mt-2">
          Applied to all exported DOCX files. Defaults are ATS-safe.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Font</label>
            <input
              className={INPUT}
              value={get("font") as string}
              onChange={(e) => updateExport("font", e.target.value)}
              placeholder="Calibri"
            />
            <p className="text-xs text-stone-400 dark:text-gray-500 mt-1">Use a font installed on your system. Calibri and Arial are safe defaults.</p>
          </div>

          <div>
            <label className={LABEL}>Accent color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border border-p-linen dark:border-p-dark-mid cursor-pointer bg-white dark:bg-p-dark-mid p-0.5"
                value={get("accentColor") as string}
                onChange={(e) => updateExport("accentColor", e.target.value)}
              />
              <input
                className={INPUT}
                value={get("accentColor") as string}
                onChange={(e) => updateExport("accentColor", e.target.value)}
                placeholder="#1E3A8A"
              />
            </div>
            <p className="text-xs text-stone-400 dark:text-gray-500 mt-1">Used for your name, section headers, and rules.</p>
          </div>

          <div>
            <label className={LABEL}>Body text color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border border-p-linen dark:border-p-dark-mid cursor-pointer bg-white dark:bg-p-dark-mid p-0.5"
                value={get("bodyColor") as string}
                onChange={(e) => updateExport("bodyColor", e.target.value)}
              />
              <input
                className={INPUT}
                value={get("bodyColor") as string}
                onChange={(e) => updateExport("bodyColor", e.target.value)}
                placeholder="#374151"
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Metadata color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border border-p-linen dark:border-p-dark-mid cursor-pointer bg-white dark:bg-p-dark-mid p-0.5"
                value={get("metaColor") as string}
                onChange={(e) => updateExport("metaColor", e.target.value)}
              />
              <input
                className={INPUT}
                value={get("metaColor") as string}
                onChange={(e) => updateExport("metaColor", e.target.value)}
                placeholder="#6B7280"
              />
            </div>
            <p className="text-xs text-stone-400 dark:text-gray-500 mt-1">Dates, contact line, and location text.</p>
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Page margins</h2>
        <p className="text-xs text-p-dusk dark:text-gray-400 -mt-2">Values in DXA twips (1 inch = 1440). Default: 0.75&quot; sides, 0.60&quot; top/bottom.</p>

        <div className="grid grid-cols-2 gap-4">
          {(
            [
              { key: "marginTopDxa", label: "Top" },
              { key: "marginBottomDxa", label: "Bottom" },
              { key: "marginLeftDxa", label: "Left" },
              { key: "marginRightDxa", label: "Right" },
            ] as { key: keyof ExportStyle; label: string }[]
          ).map(({ key, label }) => (
            <div key={key}>
              <label className={LABEL}>{label}</label>
              <input
                type="number"
                className={INPUT}
                value={get(key) as number}
                onChange={(e) => updateExport(key, Number(e.target.value))}
                min={360}
                max={2880}
                step={72}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Portfolio</h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            className="w-4 h-4 accent-p-blue dark:accent-p-accent-inv"
            checked={(get("includePortfolioPassword") as boolean) ?? false}
            onChange={(e) => updateExport("includePortfolioPassword", e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Include portfolio password in contact line
          </span>
        </label>
        <p className="text-xs text-stone-400 dark:text-gray-500 ml-6 -mt-2">
          Appends <code className="bg-p-linen dark:bg-p-dark-mid px-1 rounded">pw: [password]</code> next to your portfolio URL — useful if recipients may get locked out.
          Password is read from <code className="bg-p-linen dark:bg-p-dark-mid px-1 rounded">profile.json</code>.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save export settings"}
        </button>
      </div>
    </div>
  );
}
