import { NextRequest, NextResponse } from "next/server";
import { githubRead, githubWrite } from "@/lib/github";
import { readFileSync } from "fs";
import { resolve } from "path";

const PATH = "data/profile.json";

function isDemo() { return process.env.DEMO_MODE === "true"; }

export async function GET() {
  if (isDemo()) {
    try {
      const persona = process.env.DEMO_PERSONA ?? "design";
      const file = persona === "dev" ? "data/profile-dev.sample.json"
        : persona === "onboarding" ? "data/profile-onboarding.sample.json"
        : "data/profile.sample.json";
      const raw = readFileSync(resolve(process.cwd(), file), "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({});
    }
  }
  try {
    const raw = await githubRead(PATH);
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    await githubWrite(PATH, JSON.stringify(data, null, 2), "Update profile.json");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
