// Client helpers for the Regenerate-summary button in the two job edit forms.

export async function fetchSummarizerConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/summarize-job");
    if (!res.ok) return false;
    const data = await res.json() as { configured?: boolean };
    return data.configured === true;
  } catch {
    return false;
  }
}

export async function fetchAiSummary(job: {
  company: string;
  role: string;
  salary?: string;
  notes?: string;
}): Promise<string> {
  const res = await fetch("/api/summarize-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });
  if (!res.ok) throw new Error("Could not generate a summary");
  const data = await res.json() as { aiSummary?: string };
  return data.aiSummary ?? "";
}
