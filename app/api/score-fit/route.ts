import { NextRequest, NextResponse } from "next/server";
import { scorePendingJob } from "@/lib/score";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    company?: string;
    role?: string;
    salary?: string;
    notes?: string;
    url?: string;
  };

  const { company, role, salary, notes, url } = body;

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  try {
    const result = await scorePendingJob({ company, role, salary, notes, url });
    return NextResponse.json({ fit: result.fit, rationale: result.rationale });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
