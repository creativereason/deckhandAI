"use client"
import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** A toggleable filter. The check mark appears when on, so on/off never depends on color alone. */
function FilterChip({ pressed, onPressedChange, children, count, className }: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  children: React.ReactNode
  count?: number
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm font-medium transition-colors duration-(--duration-fast)",
        pressed ? "border-primary bg-primary-subtle text-primary-subtle-foreground" : "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {pressed && <Check className="size-4" aria-hidden />}
      {children}
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  )
}

export { FilterChip }
