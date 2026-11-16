"use client"
import { Toaster as Sonner } from "sonner"

/** Sonner themed through tokens, so toasts match cards and flip with the theme class. */
function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-full items-start gap-3 rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-lg sm:w-96",
          title: "font-medium",
          description: "text-muted-foreground",
          success: "border-success",
          error: "border-destructive",
          actionButton: "rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground",
          cancelButton: "rounded-md bg-muted px-3 py-1 text-sm font-medium",
        },
      }}
    />
  )
}

export { Toaster }
