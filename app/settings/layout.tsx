"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Profile", href: "/settings" },
  { label: "Scraping", href: "/settings/scraping" },
  { label: "Scrape Targets", href: "/settings/scrape-targets" },
  { label: "AI Profile", href: "/settings/profile-ai" },
  { label: "AI Model", href: "/settings/model" },
  { label: "Export Style", href: "/settings/export" },
  { label: "Agents", href: "/settings/agents" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell>
      <PageHeader title="Settings" description="Your profile, scraping, AI model and agent access." />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-border lg:flex-col lg:self-start lg:overflow-visible lg:border-b-0">
          {TABS.map((tab) => {
            const active = tab.href === "/settings" ? pathname === "/settings" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors duration-(--duration-fast) max-lg:rounded-b-none max-lg:border-b-2",
                  active
                    ? "bg-primary-subtle text-primary-subtle-foreground max-lg:border-primary max-lg:bg-transparent max-lg:text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground max-lg:border-transparent"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
