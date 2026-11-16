"use client"
import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive className={cn("flex flex-col gap-2", className)} {...props} />
}

function RadioItem({ label, description, className, ...props }: RadioPrimitive.Root.Props & { label: string; description?: string }) {
  return (
    <label className={cn("flex min-h-10 cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 text-sm has-data-checked:border-primary has-data-checked:bg-primary-subtle has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
      <RadioPrimitive.Root className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card data-checked:border-primary data-checked:bg-primary" {...props}>
        <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Root>
      <span className="flex flex-col"><span className="font-medium">{label}</span>{description && <span className="text-muted-foreground">{description}</span>}</span>
    </label>
  )
}

export { RadioGroup, RadioItem }
