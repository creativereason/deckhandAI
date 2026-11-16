"use client"
import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type NavItemSpec = { href: string; label: string; icon: React.ReactNode; badge?: number; active: boolean; onSelect?: () => void }

const badge = (n?: number) => (n ? <span className="rounded-sm bg-primary px-1 text-xs font-medium text-primary-foreground">{n}<span className="sr-only"> pending</span></span> : null)

/** Vertical rail (tablet/desktop). Icon above label so it works at 72px wide and has no hidden text. */
function NavRail({ items, className, children }: { items: NavItemSpec[]; className?: string; children?: React.ReactNode }) {
  return (
    <nav aria-label="Primary" className={cn("flex flex-col items-center gap-1", className)}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          onClick={i.onSelect ? (e) => { e.preventDefault(); i.onSelect?.(); } : undefined}
          className={cn("relative flex w-full flex-col items-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors duration-(--duration-fast) [&_svg]:size-5", i.active ? "bg-primary-subtle text-primary-subtle-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
        >
          {i.icon}
          <span>{i.label}</span>
          {i.badge ? <span className="absolute top-1 right-2">{badge(i.badge)}</span> : null}
        </Link>
      ))}
      {children}
    </nav>
  )
}

/** Bottom bar (phones). Same items and order as the rail, 44px+ targets. */
function BottomNav({ items, className }: { items: NavItemSpec[]; className?: string }) {
  return (
    <nav aria-label="Primary" className={cn("grid border-t border-border bg-card", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          onClick={i.onSelect ? (e) => { e.preventDefault(); i.onSelect?.(); } : undefined}
          className={cn("relative flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-medium [&_svg]:size-5", i.active ? "text-primary" : "text-muted-foreground")}
        >
          {i.icon}
          <span>{i.label}</span>
          {i.badge ? <span className="absolute top-1 right-1/4">{badge(i.badge)}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

export { BottomNav, NavRail }
