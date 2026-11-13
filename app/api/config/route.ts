import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/config-repository";
import { resolveAiSettings } from "@/lib/ai-settings";

export async function GET() {
  try {
    const config = await readConfig();
    const { effective, envLocked } = resolveAiSettings(config.ai);
    return NextResponse.json({
      ...config,
      ai_key_configured: !!process.env.AI_API_KEY,
      ai_effective: effective,
      ai_env_locked: envLocked,
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
