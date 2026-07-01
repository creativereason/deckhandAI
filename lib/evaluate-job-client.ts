export type EvaluationPayload = {
  company: string;
  role: string;
  url: string;
  salary: string;
  notes: string;
  fit: string;
  scoreRationale: string;
  retrieval: {
    retrieval_method: string;
    retrieval_limited: boolean;
    warning?: string;
    source_url?: string;
  };
};

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  const event = block.match(/^event:\s*(.+)$/m)?.[1];
  const rawData = block.match(/^data:\s*(.+)$/m)?.[1];
  if (!event || rawData === undefined) return null;
  return { event, data: JSON.parse(rawData) as unknown };
}

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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: EvaluationPayload | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (!parsed) continue;
      if (parsed.event === "status" && typeof parsed.data === "string") onStatus(parsed.data);
      if (parsed.event === "error") throw new Error(String(parsed.data));
      if (parsed.event === "result") result = parsed.data as EvaluationPayload;
    }
  }
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
