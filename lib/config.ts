import { githubRead, githubWrite } from "@/lib/github";

const CONFIG_PATH = "data/config.json";

export interface LocationConfig {
  city?: string;
  state?: string;
  zip?: string;
}

export interface CandidateConfig {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: LocationConfig;
  target_titles?: string[];
  salary_floor_fte?: number;
  salary_floor_contract?: number;
  remote_preferred?: boolean;
  hub_city?: string;
  hub_state?: string;
  hub_radius_miles?: number;
}

export interface AiConfig {
  provider?: "anthropic" | "openai" | "ollama" | "custom";
  model?: string;
  base_url?: string;
}

export interface AppConfig {
  candidate?: CandidateConfig;
  ai?: AiConfig;
}

export async function readConfig(): Promise<AppConfig> {
  try {
    const raw = await githubRead(CONFIG_PATH);
    return JSON.parse(raw) as AppConfig;
  } catch {
    return {};
  }
}

export async function writeConfig(data: AppConfig): Promise<void> {
  await githubWrite(CONFIG_PATH, JSON.stringify(data, null, 2), "Update config.json");
}
