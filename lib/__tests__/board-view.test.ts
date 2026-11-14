import { describe, expect, it } from "vitest";
import { parseBoardView, boardViewSearch } from "@/lib/board-view";

describe("parseBoardView", () => {
  // Z — Zero
  it("returns the board when there is no query string", () => {
    expect(parseBoardView("")).toBe("board");
  });

  // O — One
  it("returns the inbox when the view parameter is inbox", () => {
    expect(parseBoardView("?view=inbox")).toBe("inbox");
  });

  // B — Boundary: anything unrecognised must fall back to the safe default
  it("returns the board for an unknown view value", () => {
    expect(parseBoardView("?view=settings")).toBe("board");
  });

  // M — Many: other parameters must not interfere
  it("finds the view parameter among other parameters", () => {
    expect(parseBoardView("?q=design&view=inbox")).toBe("inbox");
  });
});

describe("boardViewSearch", () => {
  // O — One
  it("adds the view parameter for the inbox", () => {
    expect(boardViewSearch("inbox", "")).toBe("?view=inbox");
  });

  // B — Boundary: the board is the default, so its URL stays clean
  it("removes the view parameter for the board", () => {
    expect(boardViewSearch("board", "?view=inbox")).toBe("");
  });

  // M — Many: switching view keeps any other parameter
  it("preserves other parameters when switching view", () => {
    expect(boardViewSearch("inbox", "?q=design")).toBe("?q=design&view=inbox");
    expect(boardViewSearch("board", "?q=design&view=inbox")).toBe("?q=design");
  });
});
