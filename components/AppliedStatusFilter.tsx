"use client";
import { APPLIED_STATUSES } from "@/lib/applied-status-filter";
import type { JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const CHIP = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all";
const SHOWN = "bg-primary/10 text-primary border-primary/40";
const HIDDEN = "bg-card text-muted-foreground border-border line-through hover:border-ring/50";

const label = (status: JobStatus) => status.charAt(0).toUpperCase() + status.slice(1);

/** One chip per status; pressed means "shown". Hiding is display only, nothing is changed. */
export default function AppliedStatusFilter({
  counts,
  hidden,
  onToggle,
}: {
  counts: Record<JobStatus, number>;
  hidden: ReadonlySet<JobStatus>;
  onToggle: (status: JobStatus) => void;
}) {
  const hiddenTotal = APPLIED_STATUSES.filter((s) => hidden.has(s)).reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-3">
      <span className="text-xs text-muted-foreground dark:text-primary font-medium mr-1 uppercase tracking-widest">Status:</span>
      {APPLIED_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={!hidden.has(status)}
          onClick={() => onToggle(status)}
          className={cn(CHIP, hidden.has(status) ? HIDDEN : SHOWN)}
        >
          {label(status)}
          <span className="tabular-nums opacity-70">{counts[status]}</span>
        </button>
      ))}
      {hiddenTotal > 0 && <span className="text-xs text-muted-foreground ml-1">{hiddenTotal} hidden</span>}
    </div>
  );
}
