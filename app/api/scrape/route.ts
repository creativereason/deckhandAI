import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPlaywright, runScrape, type ScrapeLogEntry } from "@/lib/scrape-run";
import { getTargetsForGroup, type ScrapeGroup } from "@/lib/scrape-targets";
import { readConfig } from "@/lib/config-repository";
import { buildLocalRegex } from "@/lib/scrape-filters";
import type { PendingJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SCRAPE_GROUPS: Exclude<ScrapeGroup, "all">[] = ["remote", "local"];
const GROUP_LABELS: Record<Exclude<ScrapeGroup, "all">, string> = {
  remote: "remote/national",
  local: "local/hybrid",
};

async function isAuthenticated(): Promise<boolean> {
  if (process.env.DEMO_MODE === "true") return true;
  const session = await getSession();
  return session.authenticated === true;
}

function formatLogEntry(entry: ScrapeLogEntry): string {
  if (entry.status === "error") return `${entry.company}: failed — ${entry.error}`;
  return `${entry.company}: ${entry.listings} listings, ${entry.qualifying} qualifying, ${entry.added} new`;
}

function sse(event: "status" | "result" | "error", data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Read-only in demo mode" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  // Shared across start()/cancel() since cancel() fires on a client disconnect
  // (navigate away, close the tab) while the scrape is still in flight.
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: "status" | "result" | "error", data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by client disconnection
        }
      };

      (async () => {
        const playwright = await loadPlaywright();
        if (!playwright) {
          emit("error", "Playwright not installed. Run: pnpm exec playwright install chromium");
          return;
        }

        const config = await readConfig();
        const localRegex = buildLocalRegex(
          config.preferences?.locations?.hub_city,
          config.preferences?.locations?.hub_state
        );

        const added: PendingJob[] = [];
        const log: ScrapeLogEntry[] = [];

        for (const group of SCRAPE_GROUPS) {
          const targets = await getTargetsForGroup(group);
          if (targets.length === 0) continue;
          emit("status", `Scanning ${targets.length} ${GROUP_LABELS[group]} target${targets.length !== 1 ? "s" : ""}…`);
          const result = await runScrape(playwright, {
            targets,
            localOnly: group === "local",
            localRegex,
            onProgress: (entry) => emit("status", formatLogEntry(entry)),
          });
          added.push(...result.added);
          log.push(...result.log);
        }

        emit("result", { added: added.length, jobs: added, log });
      })()
        .catch((err) =>
          emit("error", err instanceof Error ? err.message : String(err))
        )
        .finally(safeClose);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
