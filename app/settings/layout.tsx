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
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-p-light dark:bg-p-navy">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              ← Tracker
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Settings</h1>
          </div>
        </div>

        <nav className="flex gap-1 border-b border-p-linen dark:border-p-dark-mid pb-0">
          {TABS.map((tab) => {
            const active = tab.href === "/settings"
              ? pathname === "/settings"
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors",
                  active
                    ? "border-p-accent dark:border-p-accent-inv text-p-accent dark:text-p-accent-inv bg-white dark:bg-p-dark-surface"
                    : "border-transparent text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
