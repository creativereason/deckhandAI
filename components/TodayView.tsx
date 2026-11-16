"use client";
import Link from "next/link";
import { ArrowRight, Gift, Hourglass, Inbox, MessagesSquare, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AIInsight, PromptChip } from "@/components/ai/ai";
import { EmptyState } from "@/components/ui/states";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { useAssistant } from "@/components/shell/assistant-context";
import { buildFunnel, buildNeedsYou, type NeedsYouItem, type NeedsYouKind } from "@/lib/today";
import { jobDetailHref } from "@/lib/job-detail";
import type { JobsData } from "@/lib/jobs";

const ICONS: Record<NeedsYouKind, React.ReactNode> = {
  offer: <Gift className="size-4" aria-hidden />,
  interview: <MessagesSquare className="size-4" aria-hidden />,
  "strong-fit": <Target className="size-4" aria-hidden />,
  stale: <Hourglass className="size-4" aria-hidden />,
  inbox: <Inbox className="size-4" aria-hidden />,
};

const BRIEFING_PROMPTS = ["What should I focus on this week?", "Which prospects should I apply to first?", "Where is my search stuck?"];

function Funnel({ jobs }: { jobs: JobsData }) {
  const stages = buildFunnel(jobs);
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Card>
      <CardHeader><CardTitle as="h2">Pipeline</CardTitle><Button variant="link" nativeButton={false} render={<Link href="/" />}>Open board<ArrowRight aria-hidden /></Button></CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {stages.map((s) => (
            <li key={s.id} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <div className="h-3 rounded-sm bg-muted" role="presentation"><div className="h-3 rounded-sm bg-primary" style={{ width: `${(s.count / max) * 100}%`, minWidth: s.count ? "0.5rem" : 0 }} /></div>
              <span className="text-right font-medium tabular-nums">{s.count}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function NeedsYou({ items, onInbox }: { items: NeedsYouItem[]; onInbox: () => void }) {
  const assistant = useAssistant();
  return (
    <Card padding="none">
      <CardHeader className="p-4"><CardTitle as="h2">Needs you</CardTitle></CardHeader>
      {items.length === 0 ? (
        <EmptyState compact icon={<Sparkles />} title="You're caught up" description="Nothing is waiting on you. Run a scrape or evaluate a job from the assistant." />
      ) : (
        <ListGroup className="rounded-none border-x-0 border-b-0">
          {items.map((item) => (
            <ListRow
              key={item.id}
              leading={ICONS[item.kind]}
              title={item.title}
              meta={item.detail}
              href={item.job ? jobDetailHref({ ...item.job }) : undefined}
              actions={
                <>
                  {item.kind === "inbox" && <Button size="sm" variant="outline" onClick={onInbox}>Review</Button>}
                  <Button size="sm" variant="ai" onClick={() => assistant.ask(item.prompt, { send: true })}><Sparkles aria-hidden />Ask</Button>
                </>
              }
            />
          ))}
        </ListGroup>
      )}
    </Card>
  );
}

/** Home: what needs you today, where everything stands, and a one-click way to ask about it. */
export default function TodayView({ jobs, onOpenInbox }: { jobs: JobsData; onOpenInbox: () => void }) {
  const assistant = useAssistant();
  const items = buildNeedsYou(jobs, new Date());
  return (
    <div className="flex flex-col gap-6">
      <AIInsight label="Deckhand briefing">
        <p>{items.length === 0 ? "Your board is quiet." : `${items.length} ${items.length === 1 ? "thing needs" : "things need"} you today.`} Ask for a plan and I will read your board and answer.</p>
        <div className="mt-3 flex flex-wrap gap-2">{BRIEFING_PROMPTS.map((p) => <PromptChip key={p} onClick={() => assistant.ask(p, { send: true })}>{p}</PromptChip>)}</div>
      </AIInsight>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <NeedsYou items={items} onInbox={onOpenInbox} />
        <Funnel jobs={jobs} />
      </div>
    </div>
  );
}
