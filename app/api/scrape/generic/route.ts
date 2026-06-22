import { NextRequest, NextResponse } from "next/server";
import { loadPlaywright, runScrape } from "@/lib/scrape-run";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { company, url, selector, linkBase } = body as {
    company?: string;
    url?: string;
    selector?: string;
    linkBase?: string;
  };

  if (!company?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "Company and URL are required" }, { status: 400 });
  }

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

  try {
    const { added, log } = await runScrape(playwright, {
      localOnly: true,
      targets: [
        {
          company: company.trim(),
          url: url.trim(),
          selector: selector?.trim() || undefined,
          linkBase: linkBase?.trim() || undefined,
        },
      ],
    });

    return NextResponse.json({ added: added.length, jobs: added, log });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Generic scrape fatal error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
