import { NextResponse } from "next/server";
import { readJobs, writeJobs } from "@/lib/jobs-repository";
import { scoreNewPendingJobs } from "@/lib/score";

export async function POST() {
  const jobs = await readJobs();
  if (!jobs.pending?.length) return NextResponse.json({ scored: 0 });

  const unscored = jobs.pending.filter((j) => !j.scoreRationale);
  if (unscored.length === 0) return NextResponse.json({ scored: 0 });

  await scoreNewPendingJobs(unscored);

  const scoredCount = unscored.filter((j) => j.scoreRationale).length;
  if (scoredCount > 0) await writeJobs(jobs);

  return NextResponse.json({ scored: scoredCount });
}
