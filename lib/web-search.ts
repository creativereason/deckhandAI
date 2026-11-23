const MAX_RESULTS = 8;
const TIMEOUT_MS = 8000;

type BraveResult = { title?: string; url?: string; description?: string };

export type WebSearchOutcome =
  | { results: { title: string; url: string; snippet: string }[] }
  | { error: string };

export async function searchWeb({
  query,
  fetchImpl = fetch,
}: {
  query: string;
  fetchImpl?: typeof fetch;
}): Promise<WebSearchOutcome> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return { error: "Web search is not configured: BRAVE_SEARCH_API_KEY is not set." };
  const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`;
  try {
    const response = await fetchImpl(endpoint, {
      headers: { Accept: "application/json", "X-Subscription-Token": token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { error: `Web search returned ${response.status}` };
    const data = (await response.json()) as { web?: { results?: BraveResult[] } };
    const results = (data.web?.results ?? [])
      .filter((r): r is BraveResult & { url: string } => !!r.url)
      .map((r) => ({ title: r.title ?? "", url: r.url, snippet: r.description ?? "" }));
    return { results };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
