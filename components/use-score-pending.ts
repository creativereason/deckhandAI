"use client";
import { useEffect, useRef, useState } from "react";
import type { PendingJob } from "@/lib/jobs";

/**
 * Asks the server to score any pending job that has no fit rationale yet, once per mount,
 * then refreshes. Returns true while that runs. Soft-fails: jobs just show without a score.
 */
export function useScorePending(pending: PendingJob[], onUpdate: () => void): boolean {
  const [scoring, setScoring] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !pending.some((j) => !j.scoreRationale)) return;
    fired.current = true;
    setScoring(true);
    fetch("/api/scrape/score-pending", { method: "POST" })
      .then(() => onUpdate())
      .catch(() => {})
      .finally(() => setScoring(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return scoring;
}
