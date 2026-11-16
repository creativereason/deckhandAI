import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Small status label. Tone says how it feels (neutral/info/success/warning/danger/ai), never what it is:
 * pair a tone with an icon or the word itself so state is never carried by color alone (see StatusBadge).
 */
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-sm border border-transparent px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        info: "bg-primary-subtle text-primary-subtle-foreground",
        success: "bg-success-subtle text-success-subtle-foreground",
        warning: "bg-warning-subtle text-warning-subtle-foreground",
        danger: "bg-destructive-subtle text-destructive-subtle-foreground",
        ai: "bg-ai-subtle text-ai-subtle-foreground",
        solid: "bg-primary text-primary-foreground",
        outline: "border-border text-foreground",
        // Legacy names, still produced by lib/job-badges.ts. Same tones, so screens read one vocabulary.
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive-subtle text-destructive-subtle-foreground",
        ghost: "text-muted-foreground",
        link: "text-primary underline",
        "tone-success": "bg-success-subtle text-success-subtle-foreground",
        "tone-info": "bg-primary-subtle text-primary-subtle-foreground",
        "tone-warning": "bg-warning-subtle text-warning-subtle-foreground",
        "tone-danger": "bg-destructive-subtle text-destructive-subtle-foreground",
        "tone-purple": "bg-primary-subtle text-primary-subtle-foreground",
        "tone-teal": "bg-muted text-foreground",
        "tone-orange": "bg-warning-subtle text-warning-subtle-foreground",
        "tone-neutral": "bg-muted text-muted-foreground",
        "tone-highlight": "bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
)

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
