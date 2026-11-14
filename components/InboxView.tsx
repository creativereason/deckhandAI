"use client";
import ScrapeReviewQueue from "@/components/ScrapeReviewQueue";
import { Button } from "@/components/ui/button";
import type { PendingJob } from "@/lib/jobs";

export default function InboxView({
  pending,
  onUpdate,
  onBackToBoard,
}: {
  pending: PendingJob[];
  onUpdate: () => void;
  onBackToBoard: () => void;
}) {
  if (pending.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm px-6 py-10 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">Your inbox is empty</p>
        <p className="text-xs text-muted-foreground">New jobs from scrapes and agents show up here for you to approve or dismiss.</p>
        <Button onClick={onBackToBoard} variant="outline" size="sm">Back to board</Button>
      </div>
    );
  }
  return <ScrapeReviewQueue pending={pending} onUpdate={onUpdate} />;
}
