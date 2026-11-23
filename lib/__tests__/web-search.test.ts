import { afterEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "@/lib/web-search";

afterEach(() => {
  vi.unstubAllEnvs();
});

const braveResponse = (results: unknown[]) =>
  Promise.resolve(new Response(JSON.stringify({ web: { results } }), { status: 200 }));

describe("searchWeb", () => {
  it("returns an error naming the missing key when BRAVE_SEARCH_API_KEY is unset", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    const outcome = await searchWeb({ query: "Thrivent design director" });
    expect(outcome).toEqual({ error: expect.stringContaining("BRAVE_SEARCH_API_KEY") });
  });

  it("returns title, url and snippet for each result", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "key");
    const fetchImpl = vi.fn().mockReturnValue(
      braveResponse([{ title: "Director, Design Ops", url: "https://jobs.lever.co/x/1", description: "Lead design ops" }]),
    );
    const outcome = await searchWeb({ query: "Thrivent design director", fetchImpl });
    expect(outcome).toEqual({
      results: [{ title: "Director, Design Ops", url: "https://jobs.lever.co/x/1", snippet: "Lead design ops" }],
    });
  });

  it("sends the query with the subscription token and caps results at 8", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "key");
    const fetchImpl = vi.fn().mockReturnValue(braveResponse([]));
    await searchWeb({ query: "a b", fetchImpl });
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toContain("q=a%20b");
    expect(endpoint).toContain("count=8");
    expect(init.headers["X-Subscription-Token"]).toBe("key");
  });

  it("returns an error when Brave answers with a non-OK status", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "key");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    expect(await searchWeb({ query: "x", fetchImpl })).toEqual({ error: "Web search returned 429" });
  });
});
