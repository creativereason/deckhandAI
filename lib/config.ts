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
  hide_passed?: boolean;
}

export interface ScrapingConfig {
  schedule?: string;
}

export interface AiConfig {
  provider?: "anthropic" | "openai" | "ollama" | "gemini" | "grok" | "custom";
  model?: string;
  base_url?: string | null;
}

export interface ExportStyle {
  font?: string;
  accentColor?: string;
  bodyColor?: string;
  metaColor?: string;
  marginTopDxa?: number;
  marginBottomDxa?: number;
  marginLeftDxa?: number;
  marginRightDxa?: number;
  includePortfolioPassword?: boolean;
}

export const DEFAULT_EXPORT_STYLE: Required<ExportStyle> = {
  font: "Calibri",
  accentColor: "#1E3A8A",
  bodyColor: "#374151",
  metaColor: "#6B7280",
  marginTopDxa: 864,
  marginBottomDxa: 864,
  marginLeftDxa: 1080,
  marginRightDxa: 1080,
  includePortfolioPassword: false,
};

export function resolveExportStyle(style?: ExportStyle): Required<ExportStyle> {
  return { ...DEFAULT_EXPORT_STYLE, ...style };
}

export interface AppConfig {
  candidate?: CandidateConfig;
  preferences?: PreferencesConfig;
  scraping?: ScrapingConfig;
  ai?: AiConfig;
  export?: ExportStyle;
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
