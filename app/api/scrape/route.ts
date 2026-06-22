import { NextRequest, NextResponse } from "next/server";
import { loadPlaywright, runScrape } from "@/lib/scrape-run";
import {
  findTarget,
  getTargetsForGroup,
  ScrapeGroup,
} from "@/lib/scrape-targets";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const targetCompany = body.company as string | undefined;
  const group = (body.group as ScrapeGroup) || "remote";

  const playwright = await loadPlaywright();
  if (!playwright) {
    return NextResponse.json(
      {
        error:
          "Playwright not installed. Run: pnpm exec playwright install chromium",
      },
      { status: 500 }
    );
  }

  let targets = getTargetsForGroup(group);

  if (targetCompany && targetCompany !== "All") {
    const match = findTarget(group, targetCompany);
    if (!match) {
      return NextResponse.json({ error: `Unknown company: ${targetCompany}` }, { status: 400 });
    }
    targets = [match];
  }

  try {
    const { added, log } = await runScrape(playwright, {
      targets,
      localOnly: group === "local",
    });
    return NextResponse.json({ added: added.length, jobs: added, log, group });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Scrape fatal error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
