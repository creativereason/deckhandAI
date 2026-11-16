"use client";
import { useEffect, useState } from "react";
import ScrapeReviewQueue from "@/components/ScrapeReviewQueue";
import TriageView from "@/components/TriageView";
import { Button } from "@/components/ui/button";
import type { PendingJob } from "@/lib/jobs";
import { inboxModeFromStorage, type InboxMode } from "@/lib/triage";
import { cn } from "@/lib/utils";

const MODE_STORAGE_KEY = "inbox-mode";

function ModeSwitch({ mode, onChange }: { mode: InboxMode; onChange: (mode: InboxMode) => void }) {
  const option = (value: InboxMode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return <div className="inline-flex gap-1 rounded-lg bg-muted p-1">{option("triage", "Triage")}{option("list", "List")}</div>;
}

export default function InboxView({
  pending,
  onUpdate,
  onBackToBoard,
}: {
  pending: PendingJob[];
  onUpdate: () => void;
  onBackToBoard: () => void;
}) {
  const [mode, setMode] = useState<InboxMode>("triage");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(inboxModeFromStorage(localStorage.getItem(MODE_STORAGE_KEY)));
    } catch {
      // storage can be blocked; the default mode is fine
    }
  }, []);

  function choose(next: InboxMode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // not remembered, still works
    }
  }

  if (pending.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm px-6 py-10 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">Your inbox is empty</p>
        <p className="text-xs text-muted-foreground">New jobs from scrapes and agents show up here for you to approve or dismiss.</p>
        <Button onClick={onBackToBoard} variant="outline" size="sm">Back to board</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ModeSwitch mode={mode} onChange={choose} />
      {mode === "triage" ? (
        <TriageView pending={pending} onUpdate={onUpdate} onBackToBoard={onBackToBoard} />
      ) : (
        <ScrapeReviewQueue pending={pending} onUpdate={onUpdate} />
      )}
    </div>
  );
}
