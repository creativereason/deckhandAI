import { githubRead, githubWrite } from "@/lib/github";

const CONFIG_PATH = "data/config.json";

export interface CandidateConfig {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedin?: string;
}

export interface SalaryConfig {
  min_fte?: number;
  min_contract_hourly?: number;
}

export interface LocationsConfig {
  remote?: boolean;
  hybrid?: boolean;
  hub_city?: string;
  hub_state?: string;
  hub_zip?: string;
  hub_radius_miles?: number;
}

export interface PreferencesConfig {
  titles?: string[];
  salary?: SalaryConfig;
  locations?: LocationsConfig;
  open_to_contract?: boolean;
}

export interface ScrapingConfig {
  schedule?: string;
}

export interface AiConfig {
  provider?: "anthropic" | "openai" | "ollama" | "gemini" | "grok" | "custom";
  model?: string;
  base_url?: string | null;
}

export interface AppConfig {
  candidate?: CandidateConfig;
  preferences?: PreferencesConfig;
  scraping?: ScrapingConfig;
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
