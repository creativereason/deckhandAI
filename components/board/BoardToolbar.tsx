"use client";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { FilterChip } from "@/components/ui/filter-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { BoardLayout } from "@/lib/board-layout";
import type { JobFit } from "@/lib/jobs";

export type FitFilter = JobFit | "all";
export type ToggleableSection = "applied" | "prospect" | "passed";

const FITS: { value: FitFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "strong", label: "Strong" }, { value: "good", label: "Good" }, { value: "caution", label: "Caution" }, { value: "weak", label: "Weak" },
];
const SECTIONS: { value: ToggleableSection; label: string }[] = [{ value: "applied", label: "Applied" }, { value: "prospect", label: "Prospects" }, { value: "passed", label: "Passed" }];

export function FitFilterBar({ active, onChange }: { active: FitFilter; onChange: (f: FitFilter) => void }) {
  return (
    <div role="group" aria-label="Fit" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Fit</span>
      {FITS.map((f) => <FilterChip key={f.value} pressed={active === f.value} onPressedChange={() => onChange(f.value)}>{f.label}</FilterChip>)}
    </div>
  );
}

export function SectionVisibilityBar({ visible, onToggle }: { visible: ReadonlySet<ToggleableSection>; onToggle: (s: ToggleableSection) => void }) {
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Show</span>
      {SECTIONS.map((s) => <FilterChip key={s.value} pressed={visible.has(s.value)} onPressedChange={() => onToggle(s.value)}>{s.label}</FilterChip>)}
    </div>
  );
}

/** Layout switch, search and Add job, on one row that wraps. Filters sit below, in one place. */
export function BoardToolbar({ layout, onLayout, search, onSearch, onAdd }: {
  layout: BoardLayout; onLayout: (l: BoardLayout) => void; search: string; onSearch: (s: string) => void; onAdd: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl<BoardLayout> label="Board layout" value={layout} onChange={onLayout} options={[{ value: "pipeline", label: "Pipeline" }, { value: "list", label: "List" }]} />
      <div className="relative min-w-48 flex-1 sm:max-w-sm">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search jobs" placeholder="Search company or role" value={search} onChange={(e) => onSearch(e.target.value)} className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden" />
        {search && <IconButton label="Clear search" size="icon-sm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => onSearch("")}><X aria-hidden /></IconButton>}
      </div>
      <Button onClick={onAdd} className="ml-auto"><Plus aria-hidden />Add job</Button>
    </div>
  );
}
