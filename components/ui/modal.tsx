"use client"
import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"

const Modal = DialogPrimitive.Root
const ModalTrigger = DialogPrimitive.Trigger
const ModalClose = DialogPrimitive.Close

/**
 * Dialog on tablet and up, bottom sheet on phones. Focus is trapped, Escape and backdrop close it, and the
 * title/description are wired to aria-labelledby/describedby by the primitive.
 */
function ModalContent({
  title, description, footer, size = "md", className, children, ...props
}: Omit<DialogPrimitive.Popup.Props, "title"> & { title: string; description?: string; footer?: React.ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-(--z-overlay) flex items-end justify-center sm:items-center sm:p-6">
        <DialogPrimitive.Popup
          className={cn(
            "flex max-h-[calc(100dvh-var(--spacing-touch))] w-full flex-col rounded-t-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none transition duration-(--duration-base) ease-(--ease-standard) data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 sm:rounded-xl",
            size === "sm" && "sm:max-w-md", size === "md" && "sm:max-w-xl", size === "lg" && "sm:max-w-3xl",
            className
          )}
          {...props}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:px-6">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close render={<IconButton label="Close" size="icon-sm" />}><X /></DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4 sm:px-6">{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

export { Modal, ModalClose, ModalContent, ModalTrigger }
