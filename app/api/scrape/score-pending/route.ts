import { NextResponse } from "next/server";
import { patchJobs, readJobs } from "@/lib/jobs-repository";
import { scoreNewPendingJobs } from "@/lib/score";

export async function POST() {
  const jobs = await readJobs();
  const unscored = (jobs.pending ?? []).filter((j) => !j.scoreRationale);
  if (unscored.length === 0) return NextResponse.json({ scored: 0 });

  await scoreNewPendingJobs(unscored);

  // Scoring makes slow AI calls, so write back only the two scored fields of the jobs
  // that got one. Writing the whole board would overwrite anything edited meanwhile.
  const patches = unscored
    .filter((j) => j.scoreRationale)
    .map((j) => ({
      target: { id: j.id, section: "pending" as const, company: j.company, role: j.role },
      updates: { fit: j.fit, scoreRationale: j.scoreRationale },
    }));
  if (patches.length > 0) await patchJobs(patches);

  return NextResponse.json({ scored: patches.length });
}
