"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppConfig, AiConfig } from "@/lib/config";
import type { AiSettingsView } from "@/lib/ai-settings";

const ENV_VAR_NAMES = { provider: "AI_PROVIDER", model: "AI_MODEL", base_url: "AI_BASE_URL" } as const;
const NO_LOCKS: AiSettingsView["envLocked"] = { provider: false, model: false, base_url: false };

function EnvLockNotice({ names }: { names: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
      <p>
        Set by environment variable ({names.map((n, i) => (
          <span key={n}>{i > 0 && ", "}<code className="bg-muted px-1 rounded">{n}</code></span>
        ))}), so it can&apos;t be changed here. The value shown is what the app is using.
      </p>
      <p>
        To manage it in Settings instead, remove {names.length > 1 ? "those lines" : "that line"} from{" "}
        <code className="bg-muted px-1 rounded">.env.local</code> (or from your Vercel project&apos;s Environment Variables),
        then restart the dev server or redeploy.
      </p>
    </div>
  );
}

const INPUT = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1";
const SECTION = "bg-card rounded-xl p-5 space-y-4 shadow-sm";

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
  const [effective, setEffective] = useState<AiConfig>({});
  const [locked, setLocked] = useState(NO_LOCKS);

  // Stored values are what Save writes; env-locked fields display what the server is really using.
  const stored = config.ai ?? {};
  const ai: AiConfig = {
    provider: locked.provider ? effective.provider : stored.provider,
    model: locked.model ? effective.model : stored.model,
    base_url: locked.base_url ? effective.base_url : stored.base_url,
  };
  const lockedNames = (fields: Array<keyof typeof ENV_VAR_NAMES>) =>
    fields.filter((f) => locked[f]).map((f) => ENV_VAR_NAMES[f]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig & { ai_key_configured?: boolean; ai_effective?: AiConfig; ai_env_locked?: AiSettingsView["envLocked"] }) => {
        setAiKeyConfigured(data.ai_key_configured ?? false);
        setEffective(data.ai_effective ?? {});
        setLocked(data.ai_env_locked ?? NO_LOCKS);
        // Read-only fields must not be saved back into config.json.
        const { ai_key_configured: _key, ai_effective: _eff, ai_env_locked: _lock, ...rest } = data;
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
      model: locked.model ? stored.model : preset?.defaultModel || stored.model || "",
      base_url: NEEDS_BASE_URL.includes(provider)
        ? (preset?.baseUrl ?? stored.base_url ?? "")
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
    return <div className="text-sm text-muted-foreground py-8">Loading…</div>;
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
        <div className="rounded-xl border border-tone-warning/30 bg-tone-warning/10 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-tone-warning">
            AI generation isn&apos;t configured yet
          </p>
          <p className="text-sm text-tone-warning">
            To enable cover letter and resume generation, add your API key as{" "}
            <code className="text-xs bg-tone-warning/15 px-1.5 py-0.5 rounded">AI_API_KEY</code>{" "}
            in your environment variables.
          </p>
          <ul className="text-sm text-tone-warning space-y-1 list-disc list-inside">
            <li>
              <strong>Local:</strong> add <code className="text-xs bg-tone-warning/15 px-1.5 py-0.5 rounded">AI_API_KEY=your-key</code> to{" "}
              <code className="text-xs bg-tone-warning/15 px-1.5 py-0.5 rounded">.env.local</code>, then restart the dev server
            </li>
            <li>
              <strong>Vercel:</strong> add <code className="text-xs bg-tone-warning/15 px-1.5 py-0.5 rounded">AI_API_KEY</code> in your project&apos;s Environment Variables settings, then redeploy
            </li>
          </ul>
          {currentProviderDocs && (
            <p className="text-xs text-tone-warning">
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
        <p className="text-xs text-muted-foreground">
          Used for cover letter and resume generation. Bring your own model and API key.
        </p>
        {locked.provider && <EnvLockNotice names={lockedNames(["provider"])} />}
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <label key={p.value} className={`flex items-start gap-3 ${locked.provider ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <input
                type="radio"
                name="provider"
                value={p.value}
                checked={ai.provider === p.value}
                disabled={locked.provider}
                onChange={() => handleProviderChange(p.value)}
                className="mt-0.5 accent-primary"
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
        {(locked.model || locked.base_url) && <EnvLockNotice names={lockedNames(["model", "base_url"])} />}
        <div>
          <label className={LABEL}>Model name</label>
          <input
            className={`${INPUT} disabled:opacity-60 disabled:cursor-not-allowed`}
            disabled={locked.model}
            placeholder={PROVIDERS.find((p) => p.value === ai.provider)?.defaultModel ?? ""}
            value={ai.model ?? ""}
            onChange={(e) => updateAi({ model: e.target.value })}
          />
        </div>
        {showBaseUrl && (
          <div>
            <label className={LABEL}>Base URL</label>
            <input
              className={`${INPUT} disabled:opacity-60 disabled:cursor-not-allowed`}
              disabled={locked.base_url}
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
          <span className={`inline-block w-2 h-2 rounded-full ${aiKeyConfigured || ai.provider === "ollama" ? "bg-tone-success" : "bg-tone-warning"}`} />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {ai.provider === "ollama"
              ? "Ollama does not require an API key."
              : aiKeyConfigured
              ? "API key is configured."
              : "API key is not set."}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Keys are set via environment variable (<code className="bg-muted px-1 rounded">AI_API_KEY</code>) and never stored in config — they stay server-side only.
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
