"use client"
import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger

function MenuContent({ className, align = "end", children, ...props }: MenuPrimitive.Popup.Props & { align?: "start" | "center" | "end" }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} sideOffset={4} className="z-(--z-popover)">
        <MenuPrimitive.Popup className={cn("min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none", className)} {...props}>
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({ className, destructive, ...props }: MenuPrimitive.Item.Props & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none select-none data-highlighted:bg-muted [&_svg]:size-4", destructive && "text-destructive", className)}
      {...props}
    />
  )
}

function MenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", className)} {...props} />
}

export { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger }
