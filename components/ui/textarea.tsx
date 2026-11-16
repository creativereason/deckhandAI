import * as React from "react"
import { cn } from "@/lib/utils"
import { controlClass } from "@/components/ui/field"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(controlClass, "min-h-24 py-2 leading-5", className)} {...props} />
}

export { Textarea }
