"use client"
import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Wrap in a <label> (or use `label`) so the whole row is the hit area. */
function Checkbox({ className, label, ...props }: CheckboxPrimitive.Root.Props & { label?: string }) {
  const box = (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm border border-input bg-card text-primary-foreground transition-colors duration-(--duration-fast) data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:border-2",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex" render={(p, state) => <span {...p}>{state.indeterminate ? <MinusIcon className="size-4" aria-hidden /> : <CheckIcon className="size-4" aria-hidden />}</span>} />
    </CheckboxPrimitive.Root>
  )
  if (!label) return box
  return <label className="inline-flex min-h-8 cursor-pointer items-center gap-3 text-sm">{box}{label}</label>
}

export { Checkbox }
