"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Code, Notice, SaveBar, SettingsLoading, SettingsSection, SettingsStack } from "@/components/settings/SettingsSection";
import { CheckCircle2, CircleAlert } from "lucide-react";
import type { AppConfig, AiConfig } from "@/lib/config";
import type { AiSettingsView } from "@/lib/ai-settings";

const ENV_VAR_NAMES = { provider: "AI_PROVIDER", model: "AI_MODEL", base_url: "AI_BASE_URL" } as const;
const NO_LOCKS: AiSettingsView["envLocked"] = { provider: false, model: false, base_url: false };

function EnvLockNotice({ names }: { names: string[] }) {
  return (
    <Notice>
      <p>Set by environment variable ({names.map((n, i) => <span key={n}>{i > 0 && ", "}<Code>{n}</Code></span>)}), so it can&apos;t be changed here. The value shown is what the app is using.</p>
      <p>To manage it in Settings instead, remove {names.length > 1 ? "those lines" : "that line"} from <Code>.env.local</Code> (or from your Vercel project&apos;s Environment Variables), then restart the dev server or redeploy.</p>
    </Notice>
  );
}

const PROVIDERS: { value: AiConfig["provider"]; label: string; defaultModel: string; baseUrl?: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-6" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "gemini", label: "Google Gemini (free tier available)", defaultModel: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { value: "grok", label: "Grok (xAI), tested", defaultModel: "grok-4.3", baseUrl: "https://api.x.ai/v1" },
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

  if (loading) return <SettingsLoading />;

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
    <SettingsStack>
      {!aiKeyConfigured && ai.provider !== "ollama" && (
        <Notice tone="warning" title="AI generation isn't configured yet">
          <p>To enable cover letter and resume generation, add your API key as <Code>AI_API_KEY</Code> in your environment variables.</p>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li><strong className="font-semibold">Local:</strong> add <Code>AI_API_KEY=your-key</Code> to <Code>.env.local</Code>, then restart the dev server</li>
            <li><strong className="font-semibold">Vercel:</strong> add <Code>AI_API_KEY</Code> in your project&apos;s Environment Variables settings, then redeploy</li>
          </ul>
          {currentProviderDocs && (
            <p>
              {currentProviderDocs.url ? <>Get your key at <a href={currentProviderDocs.url} target="_blank" rel="noreferrer" className="underline">{currentProviderDocs.label}<span className="sr-only"> (opens in a new tab)</span></a>.</> : currentProviderDocs.note}
              {currentProviderDocs.url && currentProviderDocs.note && <> {currentProviderDocs.note}</>}
            </p>
          )}
        </Notice>
      )}

      <SettingsSection title="AI provider" description="Used for cover letter and resume generation. Bring your own model and API key.">
        {locked.provider && <EnvLockNotice names={lockedNames(["provider"])} />}
        <RadioGroup aria-label="AI provider" value={ai.provider ?? ""} onValueChange={(v) => handleProviderChange(v as AiConfig["provider"])} disabled={locked.provider}>
          {PROVIDERS.map((p) => <RadioItem key={p.value} value={p.value} label={p.label} disabled={locked.provider} />)}
        </RadioGroup>
      </SettingsSection>

      <SettingsSection title="Model">
        {(locked.model || locked.base_url) && <EnvLockNotice names={lockedNames(["model", "base_url"])} />}
        <Field label="Model name">
          {(f) => <Input {...f} disabled={locked.model} placeholder={PROVIDERS.find((p) => p.value === ai.provider)?.defaultModel ?? ""} value={ai.model ?? ""} onChange={(e) => updateAi({ model: e.target.value })} />}
        </Field>
        {showBaseUrl && (
          <Field label="Base URL">
            {(f) => <Input {...f} disabled={locked.base_url} placeholder={PROVIDERS.find((p) => p.value === ai.provider)?.baseUrl ?? "https://your-endpoint.example.com/v1"} value={ai.base_url ?? ""} onChange={(e) => updateAi({ base_url: e.target.value })} />}
          </Field>
        )}
      </SettingsSection>

      <SettingsSection title="API key">
        <p className="flex items-center gap-2 text-sm">
          {aiKeyConfigured || ai.provider === "ollama" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <CircleAlert className="size-4 text-warning" aria-hidden />}
          {ai.provider === "ollama" ? "Ollama does not require an API key." : aiKeyConfigured ? "API key is configured." : "API key is not set."}
        </p>
        <p className="text-xs text-muted-foreground">Keys are set via environment variable (<Code>AI_API_KEY</Code>) and never stored in config. They stay server-side only.</p>
      </SettingsSection>

      <SaveBar onSave={save} saving={saving}>Save model settings</SaveBar>
    </SettingsStack>
  );
}
