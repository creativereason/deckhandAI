"use client"
import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

/** Tabs switch panels of one page (settings sections, job detail). Use SegmentedControl to change a view setting. */
const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List className={cn("relative flex gap-1 overflow-x-auto border-b border-border", className)} {...props} />
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn("inline-flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground data-active:border-primary data-active:text-foreground", className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className={cn("pt-4 outline-none", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
