import { NextRequest, NextResponse } from "next/server";
import { readDataFile, writeDataFile } from "@/lib/data-store";

const PATH = "data/profile.json";

export async function GET() {
  try {
    const raw = await readDataFile(PATH);
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    await writeDataFile(PATH, JSON.stringify(data, null, 2), "Update profile.json");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
