import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig, type AppConfig } from "@/lib/config";
import { readLocalDemoFixture, usesLocalDemoFixtures } from "@/lib/demo-fixtures";

export async function GET() {
  if (usesLocalDemoFixtures()) {
    return NextResponse.json({
      ...readLocalDemoFixture<AppConfig>("config", {}),
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
