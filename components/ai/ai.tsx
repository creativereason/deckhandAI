import * as React from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"

/**
 * Everything AI-authored or AI-triggered uses the `ai` role (coral) and the Sparkles glyph, nowhere else.
 * That is the whole rule: when you see coral + sparkle, the assistant is involved.
 */

/** A button that asks the assistant to do something. */
function AskAIButton({ children = "Ask Deckhand", ...props }: ButtonProps) {
  return <Button variant="ai" {...props}><Sparkles aria-hidden />{children}</Button>
}

/** Suggested prompt. Clicking sends it (or fills the composer) with the current item as context. */
function PromptChip({ className, children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("inline-flex min-h-8 items-center gap-2 rounded-md border border-ai/30 bg-card px-3 py-1 text-left text-sm text-foreground transition-colors duration-(--duration-fast) hover:bg-ai-subtle", className)}
      {...props}
    >
      <Sparkles className="size-4 shrink-0 text-ai" aria-hidden />
      {children}
    </button>
  )
}

/** AI-written text shown inline in a card or detail view; always labelled so people know who wrote it. */
function AIInsight({ label = "AI summary", children, className, action }: { label?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md bg-ai-subtle p-3 text-sm text-ai-subtle-foreground", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-semibold"><Sparkles className="size-4" aria-hidden />{label}</p>
        {action}
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  )
}

/** Frame for the assistant: header, scrolling body, composer. The chat logic lives in the screen that mounts it. */
function AssistantPanel({ title = "Deckhand", subtitle, onClose, headerActions, bodyRef, children, footer, className }: {
  title?: string; subtitle?: string; onClose?: () => void; headerActions?: React.ReactNode; bodyRef?: React.Ref<HTMLDivElement>
  children: React.ReactNode; footer?: React.ReactNode; className?: string
}) {
  return (
    <section aria-label={title} className={cn("flex h-full min-h-0 flex-col rounded-lg border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-start gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-ai-subtle text-ai-subtle-foreground"><Sparkles className="size-4" aria-hidden /></span>
          <div><h2 className="text-sm font-semibold">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
        </div>
      </header>
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">{children}</div>
      {footer && <footer className="border-t border-border p-3">{footer}</footer>}
    </section>
  )
}

export { AIInsight, AskAIButton, AssistantPanel, PromptChip }
