import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AgentsSettings from "@/components/AgentsSettings";
import type { AgentRecord } from "@/lib/agents";

function agent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: "7f1c2f0e-3c1d-4b8e-9a52-1f0a5d6c7e11",
    name: "Grokbot",
    keyPrefix: "dk_AbCd1234",
    scopes: ["jobs:read", "jobs:add_pending"],
    createdAt: "2026-11-14T12:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

type Handler = (init?: RequestInit) => { status: number; body: unknown };

/** Routes "METHOD /path" to a canned JSON response and records every call. */
function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const { status, body } = handler(init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentsSettings", () => {
  describe("when no agents exist yet", () => {
    it("says there are none and still offers the create form", async () => {
      // Arrange
      mockApi({ "GET /api/agents": () => ({ status: 200, body: { agents: [] } }) });

      // Act
      render(<AgentsSettings />);

      // Assert
      expect(await screen.findByText("No agents yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create agent" })).toBeInTheDocument();
    });
  });

  describe("when one agent exists", () => {
    it("shows its name, key prefix and a checked box for each granted scope", async () => {
      // Arrange
      mockApi({ "GET /api/agents": () => ({ status: 200, body: { agents: [agent()] } }) });

      // Act
      render(<AgentsSettings />);

      // Assert
      expect(await screen.findByText("Grokbot")).toBeInTheDocument();
      expect(screen.getByText("dk_AbCd1234…")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Grokbot: jobs:read" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Grokbot: jobs:add_pending" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Grokbot: jobs:archive" })).not.toBeChecked();
    });
  });
});
