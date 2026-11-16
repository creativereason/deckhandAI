import * as React from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * The three states every list/page has, with one layout each. Use these instead of a bare <p>.
 * `compact` is for inside a card or panel; the default centres in a page region.
 */
function StateShell({ compact, className, children }: { compact?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "px-4 py-8" : "px-6 py-16", className)}>{children}</div>
}

function EmptyState({ icon, title, description, action, compact }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; compact?: boolean }) {
  return (
    <StateShell compact={compact}>
      {icon && <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-6" aria-hidden>{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      {action}
    </StateShell>
  )
}

function ErrorState({ title = "Something went wrong", description, onRetry, compact }: { title?: string; description?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <StateShell compact={compact}>
      <div role="alert" className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-destructive-subtle text-destructive-subtle-foreground"><AlertCircle className="size-6" aria-hidden /></div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
        {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    </StateShell>
  )
}

function LoadingState({ label = "Loading", compact }: { label?: string; compact?: boolean }) {
  return (
    <StateShell compact={compact}>
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />{label}…
      </div>
    </StateShell>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />
}

export { EmptyState, ErrorState, LoadingState, Skeleton }
