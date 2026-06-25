import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig, type AppConfig } from "@/lib/config";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSampleConfig(): AppConfig {
  const persona = process.env.DEMO_PERSONA ?? "design";
  const file = persona === "dev" ? "data/config-dev.sample.json"
    : persona === "onboarding" ? "data/config-onboarding.sample.json"
    : "data/config.sample.json";
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf-8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return {};
  }
}

export async function GET() {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({
      ...readSampleConfig(),
      ai_key_configured: !!process.env.AI_API_KEY,
    });
  }
  try {
    const config = await readConfig();
    return NextResponse.json({
      ...config,
      ai_key_configured: !!process.env.AI_API_KEY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    await writeConfig(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
