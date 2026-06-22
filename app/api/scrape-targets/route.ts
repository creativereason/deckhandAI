import { NextRequest, NextResponse } from "next/server";
import { githubRead, githubWrite } from "@/lib/github";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

const PATH = "data/scrape-targets.json";

export interface ScrapeTargetsFile {
  remote: ScrapeTargetConfig[];
  local: ScrapeTargetConfig[];
}

const EMPTY: ScrapeTargetsFile = { remote: [], local: [] };

async function read(): Promise<ScrapeTargetsFile> {
  try {
    return JSON.parse(await githubRead(PATH));
  } catch {
    return { ...EMPTY };
  }
}

export async function GET() {
  try {
    return NextResponse.json(await read());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json() as ScrapeTargetsFile;
    await githubWrite(PATH, JSON.stringify(data, null, 2), "Update scrape-targets.json");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { group, target } = await req.json() as { group: "remote" | "local"; target: ScrapeTargetConfig };
    const data = await read();
    data[group].push(target);
    await githubWrite(PATH, JSON.stringify(data, null, 2), `Add scrape target: ${target.company}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { group, company } = await req.json() as { group: "remote" | "local"; company: string };
    const data = await read();
    data[group] = data[group].filter((t) => t.company !== company);
    await githubWrite(PATH, JSON.stringify(data, null, 2), `Remove scrape target: ${company}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
