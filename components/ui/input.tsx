import * as React from "react"
import { cn } from "@/lib/utils"
import { controlClass } from "@/components/ui/field"

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(controlClass, "h-10", className)} {...props} />
}

export { Input }
