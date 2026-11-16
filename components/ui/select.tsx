import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { controlClass } from "@/components/ui/field"

/**
 * Native select on purpose: it gets the OS picker on phones, full keyboard support and form semantics for free.
 * The caret is an icon, so it follows the theme instead of a hard-coded SVG.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select data-slot="select" className={cn(controlClass, "h-10 cursor-pointer appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { Select }
