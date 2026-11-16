"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Radar } from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Code } from "@/components/settings/SettingsSection";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

interface TargetsData {
  remote: ScrapeTargetConfig[];
  local: ScrapeTargetConfig[];
}

function TargetGroup({ title, targets }: { title: string; targets: ScrapeTargetConfig[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">{title}<Badge variant="neutral">{targets.length}</Badge></h2>
      <ListGroup>
        {targets.map((t) => (
          <ListRow
            key={t.company}
            title={t.company}
            trailing={
              <span className="flex flex-wrap justify-end gap-2">
                {t.selector && <Badge variant="neutral" className="font-mono">{t.selector}</Badge>}
                {t.assumeLocal && <Badge variant="neutral">local</Badge>}
                {t.trustLocationFilter && <Badge variant="neutral">location filtered</Badge>}
                {t.useIframe && <Badge variant="neutral">iframe</Badge>}
                {t.waitMs && <Badge variant="neutral">{t.waitMs}ms</Badge>}
              </span>
            }
          >
            <a href={t.url} target="_blank" rel="noreferrer" className="block max-w-sm truncate text-xs text-muted-foreground underline-offset-4 hover:underline">{t.url}<span className="sr-only"> (opens in a new tab)</span></a>
          </ListRow>
        ))}
      </ListGroup>
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <li className="py-3 text-sm text-muted-foreground first:pt-0 last:pb-0">{children}</li>;
}

function ScrapeSources() {
  const [targets, setTargets] = useState<TargetsData | null>(null);

  useEffect(() => {
    fetch("/api/scrape-targets")
      .then((r) => r.json())
      .then(setTargets)
      .catch(() => setTargets({ remote: [], local: [] }));
  }, []);

  const total = targets ? targets.remote.length + targets.local.length : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scraper coverage"
        description="Companies and career pages the scraper monitors for new roles."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Scraper coverage" }]}
        actions={<Button variant="outline" nativeButton={false} render={<Link href="/settings/scrape-targets" />}>Edit targets</Button>}
        className="pb-0"
      />

      {targets === null ? (
        <LoadingState label="Loading targets" />
      ) : total === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Radar />}
            title="No scrape targets configured yet"
            description="Add companies to monitor and new roles will land in your inbox."
            action={<Button nativeButton={false} render={<Link href="/settings/scrape-targets" />}>Add scrape targets</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {targets.remote.length > 0 && <TargetGroup title="Remote / National" targets={targets.remote} />}
          {targets.local.length > 0 && <TargetGroup title="Local / Hybrid" targets={targets.local} />}
        </div>
      )}

      <Card>
        <CardTitle as="h2">Scraper tips</CardTitle>
        <CardContent className="gap-0 divide-y divide-border">
          <ul className="flex flex-col divide-y divide-border">
            <Tip><strong className="font-semibold text-foreground">Keyword filtering in URL:</strong> Most ATS platforms (Greenhouse, Lever, Workday, iCIMS) support a keyword query param. Use it to pre-filter results before the selector runs, e.g. <Code>?q=designer&amp;level=senior</Code>.</Tip>
            <Tip><strong className="font-semibold text-foreground">JS-heavy pages:</strong> Set <Code>waitMs</Code> to give the page time to render before scraping. 3000ms works for most; Workday sites often need 8000–10000ms.</Tip>
            <Tip><strong className="font-semibold text-foreground">Local targets:</strong> Set <Code>assumeLocal: true</Code> for employers in your metro where the URL doesn&apos;t filter by city. Set <Code>trustLocationFilter: true</Code> when the URL already scopes to your city and you want to skip the per-row location check.</Tip>
            <Tip><strong className="font-semibold text-foreground">Not scrapeable:</strong> Some sites (Cloudflare-protected, client-side-only search) block headless browsers. Check them manually and add qualifying roles with Add job on the board.</Tip>
          </ul>
        </CardContent>
      </Card>

      <p className="border-t border-border pt-4 text-xs text-muted-foreground">Ask Deckhand to &ldquo;Scrape for new jobs&rdquo; to refresh automated sources.</p>
    </div>
  );
}

export default function ScrapeSourcesPage() {
  return <AppShell><ScrapeSources /></AppShell>;
}
