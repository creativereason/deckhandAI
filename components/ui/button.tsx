import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px active:brightness-95 dark:active:brightness-110 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline:
          "border-border bg-card text-muted-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90 aria-expanded:opacity-90",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2Icon className="animate-spin" />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
