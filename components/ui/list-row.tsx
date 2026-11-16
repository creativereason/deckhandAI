import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * A row in a list or table: leading visual, title + meta, trailing content, row actions.
 * With `href` the title is the link and the whole row's hit area is stretched over it, so rows stay
 * one tab stop while nested actions (which sit above the stretch) keep working.
 */
function ListRow({
  title, meta, leading, trailing, actions, href, selected, className, children,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
  actions?: React.ReactNode
  href?: string
  selected?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const heading = href ? (
    <Link href={href} className="font-medium text-foreground after:absolute after:inset-0 after:content-[''] hover:underline">{title}</Link>
  ) : (
    <span className="font-medium text-foreground">{title}</span>
  )
  return (
    <li
      data-slot="list-row"
      aria-current={selected || undefined}
      className={cn("relative flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/60 focus-within:bg-muted/60", selected && "bg-accent", className)}
    >
      {leading && <div className="mt-1 shrink-0 text-muted-foreground">{leading}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">{heading}{meta && <span className="text-muted-foreground">{meta}</span>}</div>
        {children}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{trailing}</div>}
      {actions && <div className="relative z-(--z-sticky) flex shrink-0 items-center gap-1">{actions}</div>}
    </li>
  )
}

function ListGroup({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul role="list" className={cn("overflow-hidden rounded-lg border border-border bg-card", className)} {...props} />
}

export { ListGroup, ListRow }
