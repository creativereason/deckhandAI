import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Icon-only buttons must say what they do: `label` becomes the accessible name and the tooltip. */
function IconButton({ label, size = "icon", variant = "ghost", children, ...props }: Omit<ButtonProps, "aria-label"> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant={variant} size={size} aria-label={label} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export { IconButton }
