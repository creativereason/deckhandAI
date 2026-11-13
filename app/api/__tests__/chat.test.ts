import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { executeTool } from "@/lib/chat-tools";

vi.mock("@/lib/config-repository", () => ({ readConfig: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/chat-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat-tools")>()),
  executeTool: vi.fn().mockResolvedValue("{\"ok\":true}"),
}));

const ORIGINAL_ENV = { ...process.env };

const toolUse = (id: string) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name: "update_job", input: {} }],
});
const answer = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

function reply(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function ask(text: string) {
  const res = await POST(new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
  }));
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as { type: string; text?: string });
  return events.find((e) => e.type === "text")?.text ?? "";
}

beforeEach(() => {
  process.env.AI_PROVIDER = "anthropic";
  process.env.AI_API_KEY = "test";
  vi.mocked(executeTool).mockClear();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("POST /api/chat", () => {
  // S — Simple: the ordinary path still returns the model's answer
  it("returns the model's answer after a tool call", async () => {
    reply(toolUse("t1"), answer("Marked 1 job declined."));

    expect(await ask("decline it")).toBe("Marked 1 job declined.");
  });

  // B — Boundary: the regression — a model that keeps calling tools used to produce a blank reply
  it("tells the user it stopped when the model keeps calling tools past the step limit", async () => {
    reply(...Array.from({ length: 10 }, (_, i) => toolUse(`t${i}`)));

    const text = await ask("move all the jobs");

    expect(text).toMatch(/step limit/i);
    expect(text).toMatch(/10 actions/);
    expect(executeTool).toHaveBeenCalledTimes(10);
  });

  // Z — Zero: an empty final message must not render as a blank bubble
  it("never returns an empty reply", async () => {
    reply({ stop_reason: "end_turn", content: [] });

    expect(await ask("hello")).toMatch(/no reply/i);
  });
});
