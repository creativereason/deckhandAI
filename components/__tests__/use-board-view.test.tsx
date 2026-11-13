import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBoardView } from "@/components/use-board-view";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("useBoardView", () => {
  // Z — Zero: a fresh visit lands on the board
  it("starts on the board when the URL has no view", () => {
    const { result } = renderHook(() => useBoardView());

    expect(result.current[0]).toBe("board");
  });

  // O — One: a reload (or shared link) with ?view=inbox stays in the inbox
  it("starts on the inbox when the URL says so", () => {
    window.history.replaceState(null, "", "/?view=inbox");

    const { result } = renderHook(() => useBoardView());

    expect(result.current[0]).toBe("inbox");
  });

  // S — Simple: switching updates both the view and the URL
  it("switches view and writes it to the URL", () => {
    const { result } = renderHook(() => useBoardView());

    act(() => result.current[1]("inbox"));

    expect(result.current[0]).toBe("inbox");
    expect(window.location.search).toBe("?view=inbox");
  });

  // B — Boundary: the board URL stays clean
  it("removes the view parameter when returning to the board", () => {
    window.history.replaceState(null, "", "/?view=inbox");
    const { result } = renderHook(() => useBoardView());

    act(() => result.current[1]("board"));

    expect(result.current[0]).toBe("board");
    expect(window.location.search).toBe("");
  });

  // B — Boundary: the browser back button must change the view too
  it("follows the browser back button", () => {
    const { result } = renderHook(() => useBoardView());
    act(() => result.current[1]("inbox"));

    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current[0]).toBe("board");
  });
});
