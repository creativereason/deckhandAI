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
    <AppShell width="prose">
      <PageHeader title="Settings" description="Your profile, scraping, AI model and agent access." className="pb-4" />
      <nav aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = tab.href === "/settings" ? pathname === "/settings" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-(--duration-fast)",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </AppShell>
  );
}
