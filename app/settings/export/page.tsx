"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppConfig, ExportStyle } from "@/lib/config";
import { DEFAULT_EXPORT_STYLE } from "@/lib/config";

const INPUT = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1";
const SECTION = "bg-card rounded-xl p-5 space-y-4 shadow-sm";

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

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Document style</h2>
        <p className="text-xs text-muted-foreground -mt-2">
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
            <p className="text-xs text-muted-foreground mt-1">Use a font installed on your system. Calibri and Arial are safe defaults.</p>
          </div>

          <div>
            <label className={LABEL}>Accent color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border border-border cursor-pointer bg-card p-0.5"
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
            <p className="text-xs text-muted-foreground mt-1">Used for your name, section headers, and rules.</p>
          </div>

          <div>
            <label className={LABEL}>Body text color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border border-border cursor-pointer bg-card p-0.5"
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
                className="h-9 w-12 rounded border border-border cursor-pointer bg-card p-0.5"
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
            <p className="text-xs text-muted-foreground mt-1">Dates, contact line, and location text.</p>
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Page margins</h2>
        <p className="text-xs text-muted-foreground -mt-2">Values in DXA twips (1 inch = 1440). Default: 0.75&quot; sides, 0.60&quot; top/bottom.</p>

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
            className="w-4 h-4 accent-primary"
            checked={(get("includePortfolioPassword") as boolean) ?? false}
            onChange={(e) => updateExport("includePortfolioPassword", e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Include portfolio password in contact line
          </span>
        </label>
        <p className="text-xs text-muted-foreground ml-6 -mt-2">
          Appends <code className="bg-muted px-1 rounded">pw: [password]</code> next to your portfolio URL — useful if recipients may get locked out.
          Password is read from <code className="bg-muted px-1 rounded">profile.json</code>.
        </p>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Styled PDF resume (beta)</h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary"
            checked={(get("stylePdfEnabled") as boolean) ?? false}
            onChange={(e) => updateExport("stylePdfEnabled", e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Enable styled PDF export
          </span>
        </label>
        <p className="text-xs text-muted-foreground ml-6 -mt-2">
          Renders a design-forward PDF resume (Inter, custom colors) alongside the DOCX export. Requires a
          self-hosted deployment with <code className="bg-muted px-1 rounded">ENABLE_PLAYWRIGHT_FALLBACK=true</code> —
          it will not work on Vercel or other serverless hosts.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} size="lg" className="px-5">
          Save export settings
        </Button>
      </div>
    </div>
  );
}
