"use client";
import { APPLIED_STATUSES } from "@/lib/applied-status-filter";
import type { JobStatus } from "@/lib/jobs";
import { FilterChip } from "@/components/ui/filter-chip";

const label = (status: JobStatus) => status.charAt(0).toUpperCase() + status.slice(1);

/** One chip per status; pressed means "shown". Hiding is display only, nothing is changed or removed. */
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
    <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Status</span>
      {APPLIED_STATUSES.map((status) => (
        <FilterChip key={status} pressed={!hidden.has(status)} onPressedChange={() => onToggle(status)} count={counts[status]}>
          {label(status)}
        </FilterChip>
      ))}
      {hiddenTotal > 0 && <span className="text-xs text-muted-foreground">{hiddenTotal} hidden</span>}
    </div>
  );
}
