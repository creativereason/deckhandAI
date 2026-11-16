"use client";
import { useState } from "react";
import { GripVertical, Sparkles } from "lucide-react";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { cardVariants } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { useAssistant } from "@/components/shell/assistant-context";
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
    <Select aria-label={`Move ${card.company} to`} className="h-8 text-xs" value="" onChange={(e) => e.target.value && onMove(card, e.target.value as MoveTarget)}>
      <option value="">Move to…</option>
      {columns.filter((c) => c.id !== own).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      <option value="passed">Passed</option>
    </Select>
  );
}

function JobCard({ card, columns, onMove, onOpen }: { card: PipelineCard; columns: PipelineColumn[] } & Pick<PipelineBoardProps, "onMove" | "onOpen">) {
  const assistant = useAssistant();
  const ask = () => assistant.ask(`Tell me about the ${card.role} role at ${card.company}: fit, red flags, and what to do next.`, { send: true });
  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, card.key); e.dataTransfer.effectAllowed = "move"; }}
      className={cn(cardVariants({ variant: "interactive", padding: "sm" }), "cursor-grab gap-2 active:cursor-grabbing")}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onOpen(card)} className="min-w-0 text-left text-sm font-semibold text-foreground hover:underline">{card.company}</button>
        <div className="flex shrink-0 items-center">
          <IconButton label={`Ask Deckhand about ${card.company}`} size="icon-sm" onClick={ask} className="text-ai"><Sparkles aria-hidden /></IconButton>
          <GripVertical className="hidden size-4 text-muted-foreground md:block" aria-hidden />
        </div>
      </div>
      <p className="text-sm text-foreground">{card.role}</p>
      {card.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{card.summary}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {card.fit && <StatusBadge kind="fit" value={card.fit} />}
        {card.salary && <span className="text-xs text-muted-foreground">{card.salary}</span>}
      </div>
      <MoveMenu card={card} columns={columns} onMove={onMove} />
    </article>
  );
}

function Column({ column, over, hiddenOnPhone, handlers, children }: { column: PipelineColumn; over: boolean; hiddenOnPhone: boolean; handlers: React.HTMLAttributes<HTMLElement>; children: React.ReactNode }) {
  return (
    <section
      aria-label={column.title}
      {...handlers}
      className={cn(
        "min-h-48 w-full flex-col gap-3 rounded-lg border border-transparent bg-muted p-3 transition-colors duration-(--duration-fast) md:flex md:w-64 md:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1",
        hiddenOnPhone ? "hidden" : "flex",
        over && "border-primary bg-primary-subtle"
      )}
    >
      <h3 className="flex items-center justify-between text-sm font-semibold">
        {column.title}
        <Badge variant="outline" className="bg-card">{column.cards.length}</Badge>
      </h3>
      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">{children}</div>
    </section>
  );
}

/**
 * Kanban of stages. Wide screens show every stage and accept drag and drop; every card also has a
 * "Move to" menu so nothing needs a mouse. Phones show one stage at a time behind a stage picker.
 */
export default function PipelineBoard({ columns, passedCount, onMove, onOpen }: PipelineBoardProps) {
  const [over, setOver] = useState<ColumnId | null>(null);
  const [phoneStage, setPhoneStage] = useState<ColumnId>(columns[0]?.id ?? "prospect");
  const cards = new Map(columns.flatMap((c) => c.cards).map((card) => [card.key, card]));
  const activeStage = columns.some((c) => c.id === phoneStage) ? phoneStage : columns[0]?.id;

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
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Stage" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:hidden">
        {columns.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === activeStage}
            onClick={() => setPhoneStage(c.id)}
            className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium", c.id === activeStage ? "border-primary bg-primary-subtle text-primary-subtle-foreground" : "border-input bg-card text-muted-foreground")}
          >
            {c.title}<span className="text-xs">{c.cards.length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:overflow-x-auto md:pb-2">
        {columns.map((column) => (
          <Column key={column.id} column={column} over={over === column.id} hiddenOnPhone={column.id !== activeStage} handlers={handlers(column)}>
            {column.cards.length === 0 && <EmptyState compact title="Nothing here" description="Drop a card, or use Move to." />}
            {column.cards.map((card) => <JobCard key={card.key} card={card} columns={columns} onMove={onMove} onOpen={onOpen} />)}
          </Column>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Passed {passedCount}</p>
    </div>
  );
}
