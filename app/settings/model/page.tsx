"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppConfig, AiConfig } from "@/lib/config";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";

const PROVIDERS: { value: AiConfig["provider"]; label: string; defaultModel: string; baseUrl?: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-6" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "gemini", label: "Google Gemini (free tier available)", defaultModel: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { value: "grok", label: "Grok (xAI) ✓ tested", defaultModel: "grok-4.3", baseUrl: "https://api.x.ai/v1" },
  { value: "ollama", label: "Ollama (local, free)", defaultModel: "llama3", baseUrl: "http://localhost:11434/v1" },
  { value: "custom", label: "Custom OpenAI-compatible endpoint", defaultModel: "" },
];

const NEEDS_BASE_URL: Array<AiConfig["provider"]> = ["ollama", "gemini", "grok", "custom"];

export default function ModelSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppConfig>({});
  const [aiKeyConfigured, setAiKeyConfigured] = useState(true);

  const ai = config.ai ?? {};

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig & { ai_key_configured?: boolean }) => {
        setAiKeyConfigured(data.ai_key_configured ?? false);
        const { ai_key_configured: _, ...rest } = data;
        setConfig(rest);
        setLoading(false);
      })
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
        ? (preset?.baseUrl ?? ai.base_url ?? "")
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

  type ProviderKey = NonNullable<AiConfig["provider"]>;
  const providerDocs: Partial<Record<ProviderKey, { label: string; url: string; note?: string }>> = {
    anthropic: {
      label: "Anthropic Console",
      url: "https://console.anthropic.com",
      note: "Separate from a Claude.ai subscription — requires credits loaded in the Console.",
    },
    openai: {
      label: "OpenAI platform",
      url: "https://platform.openai.com/api-keys",
    },
    gemini: {
      label: "Google AI Studio",
      url: "https://aistudio.google.com/api-keys",
      note: "Free tier available with a Google account. Keys start with AIza.",
    },
    grok: {
      label: "xAI Console",
      url: "https://console.x.ai",
    },
    custom: {
      label: "your provider's dashboard",
      url: "",
      note: "Any OpenAI-compatible endpoint — LM Studio, vLLM, etc.",
    },
  };

  const activeProvider: ProviderKey = ai.provider ?? "anthropic";
  const currentProviderDocs = providerDocs[activeProvider];

  return (
    <div className="space-y-6">
      {!aiKeyConfigured && ai.provider !== "ollama" && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            AI generation isn&apos;t configured yet
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            To enable cover letter and resume generation, add your API key as{" "}
            <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">AI_API_KEY</code>{" "}
            in your environment variables.
          </p>
          <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
            <li>
              <strong>Local:</strong> add <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">AI_API_KEY=your-key</code> to{" "}
              <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">.env.local</code>, then restart the dev server
            </li>
            <li>
              <strong>Vercel:</strong> add <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">AI_API_KEY</code> in your project&apos;s Environment Variables settings, then redeploy
            </li>
          </ul>
          {currentProviderDocs && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {currentProviderDocs.url ? (
                <>Get your key at <a href={currentProviderDocs.url} target="_blank" rel="noreferrer" className="underline">{currentProviderDocs.label}</a>.</>
              ) : (
                currentProviderDocs.note
              )}
              {currentProviderDocs.url && currentProviderDocs.note && (
                <> {currentProviderDocs.note}</>
              )}
            </p>
          )}
        </div>
      )}

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
              placeholder={PROVIDERS.find((p) => p.value === ai.provider)?.baseUrl ?? "https://your-endpoint.example.com/v1"}
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
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${aiKeyConfigured || ai.provider === "ollama" ? "bg-green-500" : "bg-amber-400"}`} />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {ai.provider === "ollama"
              ? "Ollama does not require an API key."
              : aiKeyConfigured
              ? "API key is configured."
              : "API key is not set."}
          </span>
        </div>
        <p className="text-xs text-p-dusk dark:text-gray-400">
          Keys are set via environment variable (<code className="bg-p-linen dark:bg-p-dark-mid px-1 rounded">AI_API_KEY</code>) and never stored in config — they stay server-side only.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} size="lg" className="px-6">
          Save model settings
        </Button>
      </div>
    </div>
  );
}
