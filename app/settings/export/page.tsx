"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Code, SaveBar, SettingsLoading, SettingsSection, SettingsStack } from "@/components/settings/SettingsSection";
import type { AppConfig, ExportStyle } from "@/lib/config";
import { DEFAULT_EXPORT_STYLE } from "@/lib/config";

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

  if (loading) return <SettingsLoading />;

  const colorField = (key: "accentColor" | "bodyColor" | "metaColor", label: string, placeholder: string, hint?: string) => (
    <Field label={label} hint={hint}>
      {(f) => (
        <div className="flex items-center gap-2">
          <input type="color" aria-label={`${label} picker`} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1" value={get(key) as string} onChange={(e) => updateExport(key, e.target.value)} />
          <Input {...f} className="font-mono" value={get(key) as string} onChange={(e) => updateExport(key, e.target.value)} placeholder={placeholder} />
        </div>
      )}
    </Field>
  );

  return (
    <SettingsStack>
      <SettingsSection title="Document style" description="Applied to all exported DOCX files. Defaults are ATS-safe.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Font" hint="Use a font installed on your system. Calibri and Arial are safe defaults.">
            {(f) => <Input {...f} value={get("font") as string} onChange={(e) => updateExport("font", e.target.value)} placeholder="Calibri" />}
          </Field>
          {colorField("accentColor", "Accent color", "#1E3A8A", "Used for your name, section headers, and rules.")}
          {colorField("bodyColor", "Body text color", "#374151")}
          {colorField("metaColor", "Metadata color", "#6B7280", "Dates, contact line, and location text.")}
        </div>
      </SettingsSection>

      <SettingsSection title="Page margins" description='Values in DXA twips (1 inch = 1440). Default: 0.75" sides, 0.60" top/bottom.'>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { key: "marginTopDxa", label: "Top" },
            { key: "marginBottomDxa", label: "Bottom" },
            { key: "marginLeftDxa", label: "Left" },
            { key: "marginRightDxa", label: "Right" },
          ] as { key: keyof ExportStyle; label: string }[]).map(({ key, label }) => (
            <Field key={key} label={label}>
              {(f) => <Input {...f} type="number" value={get(key) as number} onChange={(e) => updateExport(key, Number(e.target.value))} min={360} max={2880} step={72} />}
            </Field>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Portfolio">
        <Checkbox label="Include portfolio password in contact line" checked={(get("includePortfolioPassword") as boolean) ?? false} onCheckedChange={(v) => updateExport("includePortfolioPassword", v)} />
        <p className="text-xs text-muted-foreground">Appends <Code>pw: [password]</Code> next to your portfolio URL, useful if recipients may get locked out. The password is read from <Code>profile.json</Code>.</p>
      </SettingsSection>

      <SettingsSection title="Styled PDF resume (beta)">
        <Checkbox label="Enable styled PDF export" checked={(get("stylePdfEnabled") as boolean) ?? false} onCheckedChange={(v) => updateExport("stylePdfEnabled", v)} />
        <p className="text-xs text-muted-foreground">Renders a design-forward PDF resume (Inter, custom colors) alongside the DOCX export. Requires a self-hosted deployment with <Code>ENABLE_PLAYWRIGHT_FALLBACK=true</Code>; it will not work on Vercel or other serverless hosts.</p>
      </SettingsSection>

      <SaveBar onSave={save} saving={saving}>Save export settings</SaveBar>
    </SettingsStack>
  );
}
