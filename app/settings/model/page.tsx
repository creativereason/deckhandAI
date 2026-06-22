"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppConfig, AiConfig } from "@/lib/config";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";

const PROVIDERS: { value: AiConfig["provider"]; label: string; defaultModel: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-6" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "ollama", label: "Ollama (local)", defaultModel: "llama3" },
  { value: "custom", label: "Custom OpenAI-compatible endpoint", defaultModel: "" },
];

const NEEDS_BASE_URL: Array<AiConfig["provider"]> = ["ollama", "custom"];

export default function ModelSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppConfig>({});

  const ai = config.ai ?? {};

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig) => { setConfig(data); setLoading(false); })
      .catch(() => { toast.error("Failed to load config"); setLoading(false); });
  }, []);

  function updateAi(updates: Partial<AiConfig>) {
    setConfig((prev) => ({ ...prev, ai: { ...prev.ai, ...updates } }));
  }

  function handleProviderChange(provider: AiConfig["provider"]) {
    const preset = PROVIDERS.find((p) => p.value === provider);
    updateAi({
      provider,
      model: preset?.defaultModel || ai.model || "",
      base_url: NEEDS_BASE_URL.includes(provider)
        ? (ai.base_url ?? (provider === "ollama" ? "http://localhost:11434/v1" : ""))
        : null,
    });
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
      toast.success("Model settings saved");
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-p-dusk dark:text-gray-400 py-8">Loading…</div>;
  }

  const showBaseUrl = NEEDS_BASE_URL.includes(ai.provider);

  return (
    <div className="space-y-6">
      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          AI provider
        </h2>
        <p className="text-xs text-p-dusk dark:text-gray-400">
          Used for cover letter and resume generation. Bring your own model and API key.
        </p>
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <label key={p.value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value={p.value}
                checked={ai.provider === p.value}
                onChange={() => handleProviderChange(p.value)}
                className="mt-0.5 accent-p-accent dark:accent-p-accent-inv"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Model
        </h2>
        <div>
          <label className={LABEL}>Model name</label>
          <input
            className={INPUT}
            placeholder={PROVIDERS.find((p) => p.value === ai.provider)?.defaultModel ?? ""}
            value={ai.model ?? ""}
            onChange={(e) => updateAi({ model: e.target.value })}
          />
        </div>
        {showBaseUrl && (
          <div>
            <label className={LABEL}>Base URL</label>
            <input
              className={INPUT}
              placeholder={ai.provider === "ollama" ? "http://localhost:11434/v1" : "https://your-endpoint.example.com/v1"}
              value={ai.base_url ?? ""}
              onChange={(e) => updateAi({ base_url: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          API key
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Set your API key in <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded">.env.local</code> as{" "}
          <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded">AI_API_KEY</code>.
          Keys are never stored in config.json — they stay server-side only.
        </p>
        <p className="text-xs text-p-dusk dark:text-gray-400">
          Ollama does not require an API key.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-6 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save model settings"}
        </button>
      </div>
    </div>
  );
}
