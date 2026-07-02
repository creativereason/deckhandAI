// Split out from lib/config.ts so client components can import config types
// (AppConfig, ExportStyle, etc.) and pure helpers without pulling in
// lib/github.ts — which is server-only (it now also reaches into
// lib/demo-fixtures.ts, which touches Node's `fs`). Bundling that into a
// client component breaks the build.
import { githubRead, githubWrite } from "@/lib/github";
import type { AppConfig } from "@/lib/config";

const CONFIG_PATH = "data/config.json";

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
