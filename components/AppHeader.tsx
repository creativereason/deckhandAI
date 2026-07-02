"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function AppHeader({
  subtitle,
  secondaryLinks,
  breadcrumbs,
}: {
  subtitle?: React.ReactNode;
  secondaryLinks?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={64} height={64} className="shrink-0" />
            DeckhandAI
          </Link>
          {subtitle}
        </div>
        <div className="flex flex-col gap-2 items-start sm:items-end shrink-0 w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle />
            <a
              href="/settings"
              className="text-sm text-muted-foreground hover:text-foreground px-1 transition-colors"
              title="Settings"
            >
              Settings
            </a>
            <Button
              onClick={async () => {
                await fetch(`/api/auth/logout`, { method: "POST" });
                window.location.href = `/login`;
              }}
              variant="link"
              size="sm"
              className="text-sm"
              title="Sign out"
            >
              Sign out
            </Button>
          </div>
          {secondaryLinks && (
            <div className="flex items-center gap-3">{secondaryLinks}</div>
          )}
        </div>
      </div>

      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumbs}
        </nav>
      )}
    </div>
  );
}
