"use client";
import type { BoardView } from "@/lib/board-view";
import { cn } from "@/lib/utils";

const TAB =
  "inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export default function BoardViewSwitch({
  view,
  pendingCount,
  onChange,
}: {
  view: BoardView;
  pendingCount: number;
  onChange: (view: BoardView) => void;
}) {
  const tab = (value: BoardView, label: string, count?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === value}
      onClick={() => onChange(value)}
      className={cn(TAB, view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
      {count ? (
        <span className="rounded-full bg-tone-warning/15 text-tone-warning text-xs font-semibold px-2 py-0.5">{count}</span>
      ) : null}
    </button>
  );

  return (
    <div role="tablist" aria-label="Board view" className="inline-flex gap-1 rounded-xl bg-muted p-1">
      {tab("board", "Board")}
      {tab("inbox", "Inbox", pendingCount)}
    </div>
  );
}
