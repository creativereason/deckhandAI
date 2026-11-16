import { afterEach, describe, expect, it, vi } from "vitest";
import { submitReview } from "@/lib/review-client";

const job = { id: "7f1c2f0e-3c1d-4b8e-9a52-1f0a5d6c7e11", company: "Acme", role: "Designer" };
const reply = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("submitReview", () => {
  // O — One
  it("posts the job, the action and the fit to the review route", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitReview({ job, action: "approve", fit: "strong", scoreRationale: "Good match" });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/scrape/review");
    expect(JSON.parse(String(init.body))).toEqual({ ...job, action: "approve", fit: "strong", scoreRationale: "Good match" });
  });

  it("sends only the job's identity, not its other fields", async () => {
    const fetchMock = reply(200);
    vi.stubGlobal("fetch", fetchMock);
    const wholeJob = { ...job, notes: "scraped text", url: "https://x.test", salary: "$1" };

    await submitReview({ job: wholeJob, action: "approve" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ ...job, action: "approve" });
  });

  // E — Exception
  it("reports demo mode separately from a failure", async () => {
    vi.stubGlobal("fetch", reply(403));

    expect(await submitReview({ job, action: "reject" })).toEqual({ ok: false, demo: true });
  });

  it("returns the server's message for a failure, or the status when it gave none", async () => {
    vi.stubGlobal("fetch", reply(404, { error: "Pending job not found" }));
    expect(await submitReview({ job, action: "approve" })).toEqual({ ok: false, demo: false, message: "Pending job not found" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    expect(await submitReview({ job, action: "approve" })).toEqual({ ok: false, demo: false, message: "Error 500" });
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    expect(await submitReview({ job, action: "approve" })).toEqual({ ok: false, demo: false, message: "offline" });
  });
});
