"use client";
import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import ScrapeReviewQueue from "@/components/ScrapeReviewQueue";
import TriageView from "@/components/TriageView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { JobsData, PendingJob } from "@/lib/jobs";
import { inboxModeFromStorage, type InboxMode } from "@/lib/triage";

const MODE_STORAGE_KEY = "inbox-mode";

export default function InboxView({ pending, onUpdate, onBackToBoard, board }: { pending: PendingJob[]; onUpdate: () => void; onBackToBoard: () => void; board?: JobsData }) {
  const [mode, setMode] = useState<InboxMode>("triage");
  const [startAt, setStartAt] = useState<PendingJob | undefined>();

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(inboxModeFromStorage(localStorage.getItem(MODE_STORAGE_KEY)));
    } catch {
      // storage can be blocked; the default mode is fine
    }
  }, []);

  function choose(next: InboxMode) {
    setStartAt(undefined);
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // not remembered, still works
    }
  }

  if (pending.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<Inbox />}
          title="Your inbox is empty"
          description="New jobs from scrapes and agents show up here for you to approve or dismiss."
          action={<Button onClick={onBackToBoard} variant="outline">Back to board</Button>}
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<InboxMode> label="Inbox mode" value={mode} onChange={choose} options={[{ value: "triage", label: "Triage" }, { value: "list", label: "List" }]} className="self-start" />
      {mode === "triage"
        ? <TriageView key={startAt ? `${startAt.id ?? startAt.company}|${startAt.role}` : "queue"} pending={pending} onUpdate={onUpdate} onBackToBoard={onBackToBoard} startAt={startAt} board={board} />
        : <ScrapeReviewQueue pending={pending} onUpdate={onUpdate} onOpen={(job) => { setStartAt(job); setMode("triage"); }} />}
    </div>
  );
}
