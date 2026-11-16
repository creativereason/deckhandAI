import * as React from "react"
import { AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingState } from "@/components/ui/states"
import { cn } from "@/lib/utils"

/** One group of related settings. Every settings page is a stack of these, so they all look the same. */
export function SettingsSection({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="items-center">
        <div className="flex flex-col gap-1">
          <CardTitle as="h2">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="gap-4">{children}</CardContent>
    </Card>
  )
}

export function SettingsStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>
}

export function SaveBar({ onSave, saving, children }: { onSave: () => void; saving: boolean; children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onSave} loading={saving}>{children}</Button>
    </div>
  )
}

/** Inline message: an icon and words, so tone never carries the meaning alone. */
export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning"; title?: string; children: React.ReactNode; className?: string }) {
  const Icon = tone === "warning" ? AlertTriangle : Info
  return (
    <div role="note" className={cn("flex gap-3 rounded-md p-3 text-sm", tone === "warning" ? "bg-warning-subtle text-warning-subtle-foreground" : "bg-muted text-muted-foreground", className)}>
      <Icon className="mt-1 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-sm bg-muted px-1 font-mono text-xs text-foreground">{children}</code>
}

export const SettingsLoading = () => <LoadingState label="Loading settings" />
