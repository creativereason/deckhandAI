import { describe, expect, it } from "vitest";
import { parseBoardLayout } from "@/lib/board-layout";

describe("parseBoardLayout", () => {
  it("opens the list when nothing was saved", () => expect(parseBoardLayout(undefined)).toBe("list"));
  it("restores the pipeline when it was saved", () => expect(parseBoardLayout("pipeline")).toBe("pipeline"));
  it("restores the list when it was saved", () => expect(parseBoardLayout("list")).toBe("list"));
  it("falls back to the list for anything else", () => {
    expect(parseBoardLayout("kanban")).toBe("list");
    expect(parseBoardLayout(3)).toBe("list");
    expect(parseBoardLayout(null)).toBe("list");
  });
});
