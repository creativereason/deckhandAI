"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fitBadgeVariant } from "@/lib/job-badges";
import type { ColumnId, MoveTarget, PipelineCard, PipelineColumn } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

interface PipelineBoardProps {
  columns: PipelineColumn[];
  passedCount: number;
  onMove: (card: PipelineCard, to: MoveTarget) => void;
  onOpen: (card: PipelineCard) => void;
}

const DRAG_TYPE = "text/plain";

function cardColumn(card: PipelineCard): ColumnId {
  return card.section === "applied" ? card.status ?? "applied" : "prospect";
}

function MoveMenu({ card, columns, onMove }: { card: PipelineCard; columns: PipelineColumn[]; onMove: PipelineBoardProps["onMove"] }) {
  const own = cardColumn(card);
  return (
    <select
      aria-label={`Move ${card.company} to`}
      value=""
      onChange={(e) => e.target.value && onMove(card, e.target.value as MoveTarget)}
      className="w-full rounded-md border border-border bg-card px-1.5 py-1 text-xs text-muted-foreground"
    >
      <option value="">Move to…</option>
      {columns.filter((c) => c.id !== own).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      <option value="passed">Passed</option>
    </select>
  );
}

function Card({ card, columns, onMove, onOpen }: { card: PipelineCard; columns: PipelineColumn[] } & Pick<PipelineBoardProps, "onMove" | "onOpen">) {
  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, card.key); e.dataTransfer.effectAllowed = "move"; }}
      className="cursor-grab space-y-1.5 rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
    >
      <button type="button" onClick={() => onOpen(card)} className="block text-left text-sm font-semibold hover:underline">{card.company}</button>
      <p className="text-xs text-foreground/80">{card.role}</p>
      {card.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{card.summary}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {card.fit && <Badge variant={fitBadgeVariant(card.fit)} className="capitalize">{card.fit}</Badge>}
        {card.salary && <span className="text-xs text-muted-foreground">{card.salary}</span>}
      </div>
      <MoveMenu card={card} columns={columns} onMove={onMove} />
    </article>
  );
}

function Column({ column, over, handlers, children }: { column: PipelineColumn; over: boolean; handlers: React.HTMLAttributes<HTMLElement>; children: React.ReactNode }) {
  return (
    <section
      aria-label={column.title}
      {...handlers}
      className={cn("flex min-h-48 w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors lg:w-auto lg:min-w-0 lg:flex-1", over && "bg-primary/10 ring-2 ring-primary/40")}
    >
      <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
        {column.title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{column.cards.length}</span>
      </h3>
      {children}
    </section>
  );
}

export default function PipelineBoard({ columns, passedCount, onMove, onOpen }: PipelineBoardProps) {
  const [over, setOver] = useState<ColumnId | null>(null);
  const cards = new Map(columns.flatMap((c) => c.cards).map((card) => [card.key, card]));

  const handlers = (column: PipelineColumn): React.HTMLAttributes<HTMLElement> => ({
    onDragOver: (e) => { e.preventDefault(); setOver(column.id); },
    onDragLeave: () => setOver(null),
    onDrop: (e) => {
      e.preventDefault();
      setOver(null);
      const card = cards.get(e.dataTransfer.getData(DRAG_TYPE));
      if (card) onMove(card, column.id);
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <Column key={column.id} column={column} over={over === column.id} handlers={handlers(column)}>
            {column.cards.map((card) => <Card key={card.key} card={card} columns={columns} onMove={onMove} onOpen={onOpen} />)}
          </Column>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Passed {passedCount}</p>
    </div>
  );
}
