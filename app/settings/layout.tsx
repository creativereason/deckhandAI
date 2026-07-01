"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Profile", href: "/settings" },
  { label: "Scraping", href: "/settings/scraping" },
  { label: "Scrape Targets", href: "/settings/scrape-targets" },
  { label: "AI Profile", href: "/settings/profile-ai" },
  { label: "AI Model", href: "/settings/model" },
  { label: "Export Style", href: "/settings/export" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Tracker
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Settings</h1>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-border pb-0 overflow-x-auto">
          {TABS.map((tab) => {
            const active = tab.href === "/settings"
              ? pathname === "/settings"
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-primary bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}
