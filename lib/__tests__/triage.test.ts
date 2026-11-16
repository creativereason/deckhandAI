import { describe, expect, it } from "vitest";
import { inboxModeFromStorage, rotateQueue, settleOffset, stepOffset, triageKeyAction } from "@/lib/triage";

describe("rotateQueue", () => {
  // Z — Zero
  it("returns an empty list for an empty queue, whatever the offset", () => {
    expect(rotateQueue([], 3)).toEqual([]);
  });

  // O — One
  it("starts at the first job when the offset is zero", () => {
    expect(rotateQueue(["a", "b", "c"], 0)).toEqual(["a", "b", "c"]);
  });

  // M — Many
  it("puts the job at the offset first and wraps the rest behind it", () => {
    expect(rotateQueue(["a", "b", "c"], 1)).toEqual(["b", "c", "a"]);
  });

  // B — Boundary: offsets past either end wrap round
  it("wraps an offset larger than the queue and a negative one", () => {
    expect(rotateQueue(["a", "b", "c"], 4)).toEqual(["b", "c", "a"]);
    expect(rotateQueue(["a", "b", "c"], -1)).toEqual(["c", "a", "b"]);
  });

  it("does not change the list it was given", () => {
    const list = ["a", "b"];
    rotateQueue(list, 1);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("stepOffset and settleOffset", () => {
  it("moves forward and back, wrapping at the ends", () => {
    expect(stepOffset(0, 1, 3)).toBe(1);
    expect(stepOffset(2, 1, 3)).toBe(0);
    expect(stepOffset(0, -1, 3)).toBe(2);
  });

  it("stays at zero for an empty queue", () => {
    expect(stepOffset(5, 1, 0)).toBe(0);
    expect(settleOffset(5, 0)).toBe(0);
  });

  // I — the offset to use once the current job leaves the queue, so the next one comes up
  it("keeps the next job current after the current one is removed", () => {
    const queue = ["a", "b", "c"];
    const offset = 1; // current is b
    const settled = settleOffset(offset, queue.length);
    const after = queue.filter((job) => job !== "b");

    expect(rotateQueue(after, settled)[0]).toBe("c");
  });

  it("wraps to the first job when the last one is removed", () => {
    const queue = ["a", "b", "c"];
    const settled = settleOffset(2, queue.length); // current is c
    const after = queue.filter((job) => job !== "c");

    expect(rotateQueue(after, settled)[0]).toBe("a");
  });
});

describe("triageKeyAction", () => {
  const press = (key: string, extra: Record<string, unknown> = {}) => triageKeyAction({ key, ...extra });

  // I — Interface
  it("maps the triage keys, in either case", () => {
    expect(press("p")).toBe("pass");
    expect(press("K")).toBe("keep");
    expect(press("s")).toBe("skip");
    expect(press("ArrowRight")).toBe("skip");
    expect(press("ArrowLeft")).toBe("back");
  });

  // E — Exception: never steal a shortcut or typing
  it("ignores other keys, shortcuts with a modifier and typing in a field", () => {
    expect(press("x")).toBeUndefined();
    expect(press("p", { metaKey: true })).toBeUndefined();
    expect(press("p", { ctrlKey: true })).toBeUndefined();
    expect(press("p", { altKey: true })).toBeUndefined();
    for (const targetTag of ["INPUT", "TEXTAREA", "SELECT"]) expect(press("p", { targetTag })).toBeUndefined();
    expect(press("p", { isEditable: true })).toBeUndefined();
  });
});

describe("inboxModeFromStorage", () => {
  it("defaults to triage and accepts only the two known modes", () => {
    expect(inboxModeFromStorage(null)).toBe("triage");
    expect(inboxModeFromStorage("nonsense")).toBe("triage");
    expect(inboxModeFromStorage("list")).toBe("list");
    expect(inboxModeFromStorage("triage")).toBe("triage");
  });
});
