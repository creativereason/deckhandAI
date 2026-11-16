import * as React from "react"
import { cn } from "@/lib/utils"

/** Control chrome shared by Input, Select and Textarea so every form control looks and focuses the same. */
export const controlClass =
  "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-(--duration-fast) hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted aria-invalid:border-destructive aria-invalid:border-2 read-only:bg-muted"

/**
 * Label + control + hint/error. The control is passed a render function so ids and aria wiring
 * happen in one place: label `for`, `aria-describedby`, `aria-invalid`.
 */
function Field({
  label, hint, error, required, optional, children, className,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  className?: string
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true; required?: boolean }) => React.ReactNode
}) {
  const id = React.useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {optional && <span className="ml-2 font-normal text-muted-foreground">Optional</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required })}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}

export { Field }
