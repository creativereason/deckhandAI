import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { readConfig } from "@/lib/config-repository";
import { generateAiSummary } from "@/lib/job-summary-server";

export const dynamic = "force-dynamic";

const SummarizeRequestSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  salary: z.string().optional(),
  notes: z.string().optional(),
});

async function isAuthenticated(): Promise<boolean> {
  if (process.env.DEMO_MODE === "true") return true;
  const session = await getSession();
  return session.authenticated === true;
}

/** Whether Regenerate can produce anything — same check generateAiSummary applies. */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await readConfig();
  const configured =
    !!process.env.AI_API_KEY ||
    process.env.AI_PROVIDER === "ollama" ||
    config.ai?.provider === "ollama";
  return NextResponse.json({ configured });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = SummarizeRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const aiSummary = await generateAiSummary(parsed.data);
  return NextResponse.json({ aiSummary });
}
