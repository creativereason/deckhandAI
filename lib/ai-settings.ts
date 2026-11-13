import type { AiConfig } from "@/lib/config";

export interface AiSettingsView {
  /** What the server will actually use: an env var beats the stored config. */
  effective: AiConfig;
  /** True for each field whose value comes from the environment and so cannot be changed in Settings. */
  envLocked: { provider: boolean; model: boolean; base_url: boolean };
}

type Env = Record<string, string | undefined>;

// A blank value (`AI_MODEL=`) counts as unset so a stray line never locks a setting.
function fromEnv(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

export function resolveAiSettings(stored: AiConfig | undefined, env: Env = process.env): AiSettingsView {
  const provider = fromEnv(env, "AI_PROVIDER");
  const model = fromEnv(env, "AI_MODEL");
  const baseUrl = fromEnv(env, "AI_BASE_URL");
  return {
    effective: {
      provider: (provider as AiConfig["provider"]) ?? stored?.provider ?? "anthropic",
      model: model ?? stored?.model,
      base_url: baseUrl ?? stored?.base_url ?? undefined,
    },
    envLocked: { provider: !!provider, model: !!model, base_url: !!baseUrl },
  };
}

export function formatModelLabel(ai: AiConfig): string {
  return ai.model ? `${ai.provider ?? "anthropic"} / ${ai.model}` : "";
}
