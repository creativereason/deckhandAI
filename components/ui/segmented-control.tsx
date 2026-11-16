"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

/** Pick one of a few view modes (List | Pipeline). Radio semantics: arrow keys move, one tab stop. */
function SegmentedControl<T extends string>({
  label, value, onChange, options, className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: React.ReactNode; count?: number }[]
  className?: string
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = options.findIndex((o) => o.value === value)
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = options[(i + step + options.length) % options.length]
    onChange(next.value)
    ;(e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn("inline-flex gap-1 rounded-md bg-muted p-1", className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-value={o.value}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn("inline-flex h-8 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors duration-(--duration-fast)", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {o.icon}
            {o.label}
            {o.count ? <span className="rounded-sm bg-primary px-1 text-xs text-primary-foreground">{o.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
