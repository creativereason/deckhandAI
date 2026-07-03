import { readSseStream } from "@/lib/sse-client";

export type EvaluationPayload = {
  company: string;
  role: string;
  url: string;
  salary: string;
  notes: string;
  fit: string;
  scoreRationale: string;
  aiSummary?: string;
  retrieval: {
    retrieval_method: string;
    retrieval_limited: boolean;
    warning?: string;
    source_url?: string;
  };
};

export function evaluationMissingIdentity(evaluation: EvaluationPayload): boolean {
  return !evaluation.company.trim() || !evaluation.role.trim();
}

export async function evaluateJobUrl(
  url: string,
  onStatus: (status: string) => void
): Promise<EvaluationPayload> {
  const res = await fetch("/api/evaluate-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok || !res.body) throw new Error("Job evaluation failed");

  let result: EvaluationPayload | null = null;
  await readSseStream(res.body, (event, data) => {
    if (event === "status" && typeof data === "string") onStatus(data);
    if (event === "error") throw new Error(String(data));
    if (event === "result") result = data as EvaluationPayload;
  });
  if (!result) throw new Error("No evaluation result returned");
  return result;
}

export async function addEvaluationToPending(evaluation: EvaluationPayload): Promise<void> {
  const res = await fetch("/api/evaluate-job", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evaluation),
  });
  if (!res.ok) throw new Error("Could not add job to pending");
}
