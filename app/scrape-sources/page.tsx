"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

interface TargetsData {
  remote: ScrapeTargetConfig[];
  local: ScrapeTargetConfig[];
}

export default function ScrapeSourcesPage() {
  const [targets, setTargets] = useState<TargetsData | null>(null);

  useEffect(() => {
    fetch("/api/scrape-targets")
      .then((r) => r.json())
      .then(setTargets)
      .catch(() => setTargets({ remote: [], local: [] }));
  }, []);

  const total = targets ? targets.remote.length + targets.local.length : null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to board
        </Link>
        <div className="flex items-start justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Scraper Coverage</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Companies and career pages the scraper monitors for new roles.
            </p>
          </div>
          <Link
            href="/settings/scrape-targets"
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-ring/50 transition-colors"
          >
            Edit targets →
          </Link>
        </div>
      </div>

      {/* Configured targets */}
      {targets === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No scrape targets configured yet.</p>
          <p className="text-xs text-muted-foreground">
            Add companies to monitor in{" "}
            <Link href="/settings/scrape-targets" className="text-primary hover:underline">
              Settings → Scrape Targets
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {targets.remote.length > 0 && (
            <TargetGroup title="Remote / National" targets={targets.remote} />
          )}
          {targets.local.length > 0 && (
            <TargetGroup title="Local / Hybrid" targets={targets.local} />
          )}
        </div>
      )}

      {/* Tips */}
      <Section title="Scraper tips" color="green">
        <InfoRow>
          <strong className="text-gray-800 dark:text-gray-100">Keyword filtering in URL:</strong>{" "}
          Most ATS platforms (Greenhouse, Lever, Workday, iCIMS) support a keyword query param.
          Use it to pre-filter results before the selector runs — e.g.{" "}
          <Code>?q=designer&level=senior</Code>.
        </InfoRow>
        <InfoRow>
          <strong className="text-gray-800 dark:text-gray-100">JS-heavy pages:</strong> Set{" "}
          <Code>waitMs</Code> to give the page time to render before scraping. 3000ms works for
          most; Workday sites often need 8000–10000ms.
        </InfoRow>
        <InfoRow>
          <strong className="text-gray-800 dark:text-gray-100">Local targets:</strong> Set{" "}
          <Code>assumeLocal: true</Code> for employers in your metro where the URL doesn&apos;t
          filter by city. Set <Code>trustLocationFilter: true</Code> when the URL already scopes
          to your city and you want to skip the per-row location check.
        </InfoRow>
        <InfoRow>
          <strong className="text-gray-800 dark:text-gray-100">Not scrapeable:</strong> Some sites
          (Cloudflare-protected, client-side-only search) block headless browsers. Check them
          manually and add qualifying roles via the Add Job button in the tracker.
        </InfoRow>
      </Section>

      <div className="text-xs text-muted-foreground pt-4 border-t border-border">
        Run the Scrape button from the main tracker to refresh automated sources.
      </div>
    </main>
  );
}

function TargetGroup({ title, targets }: { title: string; targets: ScrapeTargetConfig[] }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        {title}
        <span className="font-normal normal-case tracking-normal text-muted-foreground">
          ({targets.length})
        </span>
      </h2>
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {targets.map((t) => (
          <div key={t.company} className="flex items-start justify-between gap-4 px-4 py-3 bg-card">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.company}</p>
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:underline truncate block max-w-sm"
              >
                {t.url}
              </a>
            </div>
            <div className="shrink-0 flex flex-wrap gap-1 justify-end pt-0.5">
              {t.selector && <Tag>{t.selector}</Tag>}
              {t.assumeLocal && <Tag>local</Tag>}
              {t.trustLocationFilter && <Tag>location filtered</Tag>}
              {t.useIframe && <Tag>iframe</Tag>}
              {t.waitMs && <Tag>{t.waitMs}ms</Tag>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
      {children}
    </span>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="text-xs bg-muted text-gray-700 dark:text-gray-300 px-1 py-0.5 rounded">
      {children}
    </code>
  );
}

function Section({ title, color, children }: { title: string; color: "green" | "yellow" | "gray"; children: ReactNode }) {
  const dot = { green: "bg-tone-success", yellow: "bg-tone-warning", gray: "bg-muted-foreground" }[color];
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {title}
      </h2>
      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3 bg-card text-sm text-muted-foreground leading-relaxed">
      {children}
    </div>
  );
}
