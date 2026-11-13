import { describe, expect, it } from "vitest";
import { finalReply } from "@/lib/chat-reply";

describe("finalReply", () => {
  // O — One: a normal answer passes through untouched
  it("returns the model's text when it finished normally", () => {
    expect(finalReply({ text: "Moved 3 jobs.", hitRoundLimit: false, toolCalls: 2 })).toBe("Moved 3 jobs.");
  });

  // Z — Zero: an empty reply must never reach the user as a blank bubble
  it("explains that no summary came back when the text is empty after running actions", () => {
    const reply = finalReply({ text: "", hitRoundLimit: false, toolCalls: 4 });

    expect(reply).toMatch(/4 actions?/);
    expect(reply).toMatch(/check the board/i);
  });

  it("says it got no answer when nothing ran and the text is empty", () => {
    expect(finalReply({ text: "", hitRoundLimit: false, toolCalls: 0 })).toMatch(/no reply/i);
  });

  // B — Boundary: stopping at the step limit is not success, even if some text exists
  it("tells the user it stopped early and how to continue when the step limit was hit", () => {
    const reply = finalReply({ text: "Working on it.", hitRoundLimit: true, toolCalls: 10 });

    expect(reply).toContain("Working on it.");
    expect(reply).toMatch(/step limit/i);
    expect(reply).toMatch(/continue/i);
  });

  it("still gives a message when the step limit was hit with no text at all", () => {
    expect(finalReply({ text: "", hitRoundLimit: true, toolCalls: 10 })).toMatch(/step limit/i);
  });
});
