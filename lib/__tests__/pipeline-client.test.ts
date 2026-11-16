import { describe, expect, it, vi } from "vitest";
import { applyMove } from "@/lib/pipeline-client";
import type { PipelineCard } from "@/lib/pipeline";

const card = (over: Partial<PipelineCard> = {}): PipelineCard => ({ key: "k", id: "id-1", company: "Acme", role: "Lead", salary: "", section: "prospect", ...over });
const okFetch = () => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
const bodyOf = (fetchFn: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetchFn.mock.calls[call][1].body as string);

describe("applyMove", () => {
  // Z
  it("sends nothing and succeeds when the action is null", async () => {
    const fetchFn = okFetch();

    expect(await applyMove(card(), null, fetchFn)).toEqual({ ok: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  // O
  it("moves a card to another section with one request naming the job by id", async () => {
    const fetchFn = okFetch();

    await applyMove(card(), { section: "passed" }, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE");
    expect(bodyOf(fetchFn, 0)).toMatchObject({ id: "id-1", section: "prospect", targetSection: "passed" });
  });

  it("changes only the status with a patch when the section stays the same", async () => {
    const fetchFn = okFetch();

    await applyMove(card({ section: "applied", status: "applied" }), { section: "applied", status: "interview" }, fetchFn);

    expect(fetchFn.mock.calls[0][1].method).toBe("PATCH");
    expect(bodyOf(fetchFn, 0)).toMatchObject({ id: "id-1", section: "applied", updates: { status: "interview" } });
  });

  // M
  it("moves into Applied first, then sets the status", async () => {
    const fetchFn = okFetch();

    await applyMove(card(), { section: "applied", status: "offer" }, fetchFn);

    expect(fetchFn.mock.calls.map((c) => c[1].method)).toEqual(["DELETE", "PATCH"]);
    expect(bodyOf(fetchFn, 1)).toMatchObject({ section: "applied", updates: { status: "offer" } });
  });

  // E — Exception
  it("reports failure and skips the status step when the move is refused", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });

    const result = await applyMove(card(), { section: "applied", status: "offer" }, fetchFn);

    expect(result).toEqual({ ok: false, message: "boom" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("reports failure when the network call throws", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));

    expect(await applyMove(card(), { section: "passed" }, fetchFn)).toEqual({ ok: false, message: "offline" });
  });
});
