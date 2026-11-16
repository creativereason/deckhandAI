"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/states";
import { jobDetailHref } from "@/lib/job-detail";
import { nextSort, sortRows, type SortState } from "@/lib/table-sort";
import { typeBadgeVariant } from "@/lib/job-badges";
import { cn } from "@/lib/utils";
import { JobActions, type JobActionHandlers } from "@/components/board/JobActions";
import type { BoardRow } from "@/components/board/board-row";

export type RowHandlers = (row: BoardRow) => JobActionHandlers & { onEdit: () => void };

const SORTS: Record<string, { value: string; label: string }[]> = {
  applied: [{ value: "signal", label: "Needs attention" }, { value: "company", label: "Company" }, { value: "status", label: "Status" }, { value: "date", label: "Date" }, { value: "salary", label: "Salary" }],
  prospect: [{ value: "signal", label: "Best fit" }, { value: "company", label: "Company" }, { value: "role", label: "Role" }, { value: "salary", label: "Salary" }],
  passed: [{ value: "company", label: "Company" }, { value: "role", label: "Role" }, { value: "salary", label: "Salary" }],
};

function sortKey(row: BoardRow, column: string): string {
  if (column === "signal") return row.signalSort;
  if (column === "fit") return row.fit ?? "";
  if (column === "status") return row.status ?? "";
  if (column === "date") return row.date ?? "";
  if (column === "company") return row.company;
  if (column === "role") return row.role;
  return row.salary;
}

function Row({ row, handlers }: { row: BoardRow; handlers: RowHandlers }) {
  const h = handlers(row);
  return (
    <ListRow
      title={row.company}
      meta={row.role}
      href={jobDetailHref({ id: row.id, company: row.company, role: row.role, section: row.section })}
      trailing={
        <span className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
          {row.isNew && <Badge variant="solid">New</Badge>}
          {row.status && <StatusBadge kind="status" value={row.status} />}
          {row.fit && <StatusBadge kind="fit" value={row.fit} />}
          {row.attention && <Badge variant="warning">{row.attention}</Badge>}
          {row.type && <Badge variant={typeBadgeVariant(row.type)} className="capitalize">{row.type}</Badge>}
        </span>
      }
      actions={<><Button variant="ghost" size="sm" onClick={h.onEdit}>Edit</Button><JobActions company={row.company} {...h} /></>}
      className={cn(row.isNew && "bg-primary-subtle/40")}
    >
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        {row.isNew && <Badge variant="solid">New</Badge>}
        {row.status && <StatusBadge kind="status" value={row.status} />}
        {row.fit && <StatusBadge kind="fit" value={row.fit} />}
        {row.attention && <Badge variant="warning">{row.attention}</Badge>}
        {row.type && <Badge variant={typeBadgeVariant(row.type)} className="capitalize">{row.type}</Badge>}
      </div>
      {(row.salary || row.date) && <p className="text-xs text-muted-foreground">{[row.date, row.salary].filter(Boolean).join(" · ")}</p>}
      {row.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>}
      {row.rationale && <p className="flex items-start gap-1 text-xs text-ai-subtle-foreground"><Sparkles className="mt-1 size-3 shrink-0" aria-hidden /><span>{row.rationale}</span></p>}
    </ListRow>
  );
}

/** One collapsible section of the list layout. Replaces the three near-identical Applied / Prospect / Passed tables. */
export function JobList({ kind, title, rows, total, newCount, handlers, emptyTitle, defaultOpen = true, toolbar }: {
  kind: "applied" | "prospect" | "passed"
  title: string
  rows: BoardRow[]
  total: number
  newCount?: number
  handlers: RowHandlers
  emptyTitle: string
  defaultOpen?: boolean
  toolbar?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [sort, setSort] = useState<SortState>({ column: kind === "passed" ? "company" : "signal", dir: "asc" });
  const sorted = useMemo(() => sortRows(rows, sort, sortKey), [rows, sort]);
  const id = `section-${kind}`;
  const filtered = rows.length !== total;

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-border bg-card">
      <h2 className="flex items-center gap-3 p-4" id={`${id}-title`}>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex min-h-8 flex-1 items-center gap-2 text-left text-base font-semibold">
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-(--duration-fast)", !open && "-rotate-90")} aria-hidden />
          {title}
          <Badge variant="neutral">{filtered ? `${rows.length} of ${total}` : total}</Badge>
          {!!newCount && <Badge variant="solid">{newCount} new</Badge>}
        </button>
      </h2>
      {open && (
        <div id={id} className="flex flex-col gap-3 px-4 pb-4">
          {toolbar}
          {rows.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <label htmlFor={`${id}-sort`} className="text-xs text-muted-foreground">Sort by</label>
              <Select id={`${id}-sort`} className="h-8 w-auto" value={sort.column} onChange={(e) => setSort({ column: e.target.value, dir: "asc" })}>
                {SORTS[kind].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              <Button variant="outline" size="icon-sm" aria-label={sort.dir === "asc" ? "Sorted ascending, switch to descending" : "Sorted descending, switch to ascending"} onClick={() => setSort((s) => nextSort(s, s.column))}>
                {sort.dir === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
              </Button>
            </div>
          )}
          {sorted.length === 0
            ? <EmptyState compact title={emptyTitle} />
            : <ListGroup>{sorted.map((row) => <Row key={row.key} row={row} handlers={handlers} />)}</ListGroup>}
        </div>
      )}
    </section>
  );
}
