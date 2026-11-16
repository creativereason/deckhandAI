import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * The one surface. `raised` lifts it, `interactive` is for whole-card links/buttons (hover + focus),
 * `ai` marks content the assistant wrote, `muted` is a quiet well inside another card.
 */
const cardVariants = cva("flex flex-col gap-4 rounded-lg border text-card-foreground", {
  variants: {
    variant: {
      default: "border-border bg-card",
      raised: "border-border bg-card shadow-sm",
      interactive: "border-border bg-card shadow-sm transition-shadow duration-(--duration-base) hover:shadow-md focus-within:shadow-md",
      ai: "border-ai/30 bg-ai-subtle",
      muted: "border-transparent bg-muted",
    },
    padding: { none: "", sm: "p-3", default: "p-4", lg: "p-6" },
  },
  defaultVariants: { variant: "default", padding: "default" },
})

function Card({ className, variant, padding, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant, padding }), className)} {...props} />
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex items-start justify-between gap-3", className)} {...props} />
}

function CardTitle({ className, as: Tag = "h3", ...props }: React.ComponentProps<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return <Tag data-slot="card-title" className={cn("text-base font-semibold text-foreground", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-3", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3", className)} {...props} />
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants }
