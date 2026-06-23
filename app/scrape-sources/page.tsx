import type { ReactNode } from "react";

export default function ScrapeSourcesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Scraper Coverage</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure your scrape targets in{" "}
          <Code>lib/scrape-targets.ts</Code>.
          This page reflects whatever targets are defined there.
        </p>
      </div>

      <Section title="Getting started" color="yellow">
        <InfoRow>
          Add your target companies to <Code>lib/scrape-targets.ts</Code>. Separate
          remote/national targets from local/hybrid ones using the{" "}
          <Code>REMOTE_TARGETS</Code> and <Code>LOCAL_TARGETS</Code> arrays. Each entry needs a
          company name, career search URL, CSS selector, and optional config.
        </InfoRow>
      </Section>

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

      <div className="text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-100 dark:border-p-dark-mid">
        Run the Scrape button from the main tracker to refresh automated sources.
      </div>
    </main>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="text-xs bg-gray-100 dark:bg-p-dark-mid text-gray-700 dark:text-gray-300 px-1 py-0.5 rounded">
      {children}
    </code>
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
    gray: "bg-gray-300 dark:bg-gray-600",
  }[color];

  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {title}
      </h2>
      <div className="divide-y divide-gray-100 dark:divide-p-dark-mid border border-gray-100 dark:border-p-dark-mid rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3 bg-white dark:bg-p-dark-surface text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      {children}
    </div>
  );
}
