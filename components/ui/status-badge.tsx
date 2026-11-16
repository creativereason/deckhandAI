import { AlertTriangle, Ban, CircleDot, Flame, Gift, Hourglass, MessagesSquare, Send, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { JobFit, JobStatus } from "@/lib/jobs"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"
const STATUS: Record<JobStatus, { label: string; tone: Tone; Icon: LucideIcon }> = {
  applied: { label: "Applied", tone: "info", Icon: Send },
  screening: { label: "Screening", tone: "info", Icon: Hourglass },
  interview: { label: "Interview", tone: "warning", Icon: MessagesSquare },
  offer: { label: "Offer", tone: "success", Icon: Gift },
  declined: { label: "Declined", tone: "danger", Icon: Ban },
}
const FIT: Record<JobFit, { label: string; tone: Tone; Icon: LucideIcon }> = {
  strong: { label: "Strong fit", tone: "success", Icon: Flame },
  good: { label: "Good fit", tone: "info", Icon: ThumbsUp },
  caution: { label: "Caution", tone: "warning", Icon: AlertTriangle },
  weak: { label: "Weak fit", tone: "danger", Icon: ThumbsDown },
}

/** Status and fit always render an icon and a word, so the tone is reinforcement, never the only signal. */
function StatusBadge({ kind, value }: { kind: "status"; value: JobStatus } | { kind: "fit"; value: JobFit }) {
  const entry = kind === "status" ? STATUS[value as JobStatus] : FIT[value as JobFit]
  if (!entry) return <Badge variant="neutral"><CircleDot aria-hidden />{String(value)}</Badge>
  return <Badge variant={entry.tone}><entry.Icon aria-hidden />{entry.label}</Badge>
}

export { StatusBadge, STATUS as STATUS_META, FIT as FIT_META }
