import type { ReactNode } from "react";

export default function ScrapeSourcesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Scraper Coverage</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your scrape targets in{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">lib/scrape-targets.ts</code>.
          This page reflects whatever targets are defined there.
        </p>
      </div>

      <Section title="Getting started" color="yellow">
        <InfoRow>
          Add your target companies to{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">lib/scrape-targets.ts</code>.
          Separate remote/national targets from local/hybrid ones using the{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">REMOTE_TARGETS</code> and{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">LOCAL_TARGETS</code> arrays.
          Each entry needs a company name, career search URL, CSS selector, and optional config.
        </InfoRow>
      </Section>

      <Section title="Scraper tips" color="green">
        <InfoRow>
          <strong>Keyword filtering in URL:</strong> Most ATS platforms (Greenhouse, Lever,
          Workday, iCIMS) support a keyword query param. Use it to pre-filter results before
          the selector runs — e.g.{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">?q=designer&level=senior</code>.
        </InfoRow>
        <InfoRow>
          <strong>JS-heavy pages:</strong> Set{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">waitMs</code> to give the
          page time to render before scraping. 3000ms works for most; Workday sites often need
          8000–10000ms.
        </InfoRow>
        <InfoRow>
          <strong>Local targets:</strong> Set{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">assumeLocal: true</code> for
          employers in your metro where the URL doesn&apos;t filter by city. Set{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">trustLocationFilter: true</code>{" "}
          when the URL already scopes to your city and you want to skip the per-row location check.
        </InfoRow>
        <InfoRow>
          <strong>Not scrapeable:</strong> Some sites (Cloudflare-protected, client-side-only
          search) block headless browsers. Check them manually and add qualifying roles via the
          Add Job button in the tracker.
        </InfoRow>
      </Section>

      <div className="text-xs text-gray-400 pt-4 border-t">
        Run the Scrape button from the main tracker to refresh automated sources.
      </div>
    </main>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: "green" | "yellow" | "gray";
  children: ReactNode;
}) {
  const dot = {
    green: "bg-green-500",
    yellow: "bg-yellow-400",
    gray: "bg-gray-300",
  }[color];

  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {title}
      </h2>
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3 bg-white text-sm text-gray-600 leading-relaxed">
      {children}
    </div>
  );
}
