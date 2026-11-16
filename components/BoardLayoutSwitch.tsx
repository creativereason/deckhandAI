"use client";
import type { BoardLayout } from "@/lib/board-layout";
import { cn } from "@/lib/utils";

export default function BoardLayoutSwitch({ layout, onChange }: { layout: BoardLayout; onChange: (layout: BoardLayout) => void }) {
  const option = (value: BoardLayout, label: string) => (
    <button
      type="button"
      aria-pressed={layout === value}
      onClick={() => onChange(value)}
      className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", layout === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </button>
  );
  return <div className="inline-flex gap-1 rounded-lg bg-muted p-1">{option("list", "List")}{option("pipeline", "Pipeline")}</div>;
}
