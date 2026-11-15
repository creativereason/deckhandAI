import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  describe("when several agents exist and one is revoked", () => {
    it("lists all of them and locks the revoked agent's scopes", async () => {
      // Arrange
      const active = agent();
      const revoked = agent({ id: "0b6c9f3e-1111-4c2d-8e3f-2a3b4c5d6e7f", name: "Muse", keyPrefix: "dk_Muse0000", revokedAt: "2026-11-15T09:00:00.000Z" });
      mockApi({ "GET /api/agents": () => ({ status: 200, body: { agents: [active, revoked] } }) });

      // Act
      render(<AgentsSettings />);

      // Assert
      expect(await screen.findByText("Grokbot")).toBeInTheDocument();
      expect(screen.getByText("Muse")).toBeInTheDocument();
      expect(screen.getByText("Revoked")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Muse: jobs:read" })).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: "Grokbot: jobs:archive" })).toBeEnabled();
    });
  });

  describe("when a scope checkbox is clicked", () => {
    it("sends the toggled scope list to PATCH /api/agents/{id} and shows it checked", async () => {
      // Arrange
      const a = agent();
      const fetchMock = mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [a] } }),
        [`PATCH /api/agents/${a.id}`]: () => ({ status: 200, body: { ok: true } }),
      });
      render(<AgentsSettings />);
      const archive = await screen.findByRole("checkbox", { name: "Grokbot: jobs:archive" });

      // Act
      fireEvent.click(archive);

      // Assert
      await waitFor(() => expect(archive).toBeChecked());
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ scopes: ["jobs:read", "jobs:add_pending", "jobs:archive"] });
    });

    it("sends nothing when the click would remove the agent's only scope", async () => {
      // Arrange
      const a = agent({ scopes: ["jobs:read"] });
      const fetchMock = mockApi({ "GET /api/agents": () => ({ status: 200, body: { agents: [a] } }) });
      render(<AgentsSettings />);
      const read = await screen.findByRole("checkbox", { name: "Grokbot: jobs:read" });

      // Act
      fireEvent.click(read);

      // Assert
      expect(read).toBeChecked();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("when an agent is created", () => {
    it("posts the name and chosen scopes, then shows the key and connect command once", async () => {
      // Arrange
      const created = agent({ id: "5d4c3b2a-2222-4abc-9def-0123456789ab", name: "Duet", keyPrefix: "dk_Duet1234", scopes: ["jobs:read", "jobs:add_pending", "jobs:edit"] });
      const fetchMock = mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [] } }),
        "POST /api/agents": () => ({ status: 201, body: { agent: created, key: "dk_Duet1234secretsecret" } }),
      });
      render(<AgentsSettings />);
      fireEvent.change(await screen.findByLabelText("Agent name"), { target: { value: "Duet" } });
      fireEvent.click(screen.getByRole("checkbox", { name: "New agent: jobs:edit" }));

      // Act
      fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

      // Assert
      expect(await screen.findByText("dk_Duet1234secretsecret")).toBeInTheDocument();
      expect(screen.getByText(/claude mcp add --transport http deckhand .*\/api\/mcp --header "Authorization: Bearer dk_Duet1234secretsecret"/)).toBeInTheDocument();
      expect(screen.getByText("Duet")).toBeInTheDocument();
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({ name: "Duet", scopes: ["jobs:read", "jobs:add_pending", "jobs:edit"] });
    });

    it("removes the key from the page when Done is clicked", async () => {
      // Arrange
      mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [] } }),
        "POST /api/agents": () => ({ status: 201, body: { agent: agent({ name: "Duet" }), key: "dk_Duet1234secretsecret" } }),
      });
      render(<AgentsSettings />);
      fireEvent.change(await screen.findByLabelText("Agent name"), { target: { value: "Duet" } });
      fireEvent.click(screen.getByRole("button", { name: "Create agent" }));
      await screen.findByText("dk_Duet1234secretsecret");

      // Act
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      // Assert
      expect(screen.queryByText("dk_Duet1234secretsecret")).not.toBeInTheDocument();
    });
  });

  describe("when Revoke is clicked", () => {
    it("revokes the agent after confirmation and marks it revoked", async () => {
      // Arrange
      const a = agent();
      const fetchMock = mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [a] } }),
        [`POST /api/agents/${a.id}/revoke`]: () => ({ status: 200, body: { ok: true } }),
      });
      vi.stubGlobal("confirm", vi.fn(() => true));
      render(<AgentsSettings />);

      // Act
      fireEvent.click(await screen.findByRole("button", { name: "Revoke Grokbot" }));

      // Assert
      expect(await screen.findByText("Revoked")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Revoke Grokbot" })).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(`/api/agents/${a.id}/revoke`, expect.objectContaining({ method: "POST" }));
    });

    it("sends nothing when the confirmation is cancelled", async () => {
      // Arrange
      const fetchMock = mockApi({ "GET /api/agents": () => ({ status: 200, body: { agents: [agent()] } }) });
      vi.stubGlobal("confirm", vi.fn(() => false));
      render(<AgentsSettings />);

      // Act
      fireEvent.click(await screen.findByRole("button", { name: "Revoke Grokbot" }));

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Revoked")).not.toBeInTheDocument();
    });
  });

  describe("when the server refuses a request", () => {
    it("explains that agents need Supabase when the list answers 409", async () => {
      // Arrange
      mockApi({ "GET /api/agents": () => ({ status: 409, body: { error: "Agents need DATA_BACKEND=supabase" } }) });

      // Act
      render(<AgentsSettings />);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("Agents need DATA_BACKEND=supabase");
      expect(screen.queryByRole("button", { name: "Create agent" })).not.toBeInTheDocument();
    });

    it("shows the error and no key when the name is already taken", async () => {
      // Arrange
      mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [] } }),
        "POST /api/agents": () => ({ status: 409, body: { error: "An agent named Grokbot already exists" } }),
      });
      render(<AgentsSettings />);
      fireEvent.change(await screen.findByLabelText("Agent name"), { target: { value: "Grokbot" } });

      // Act
      fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("An agent named Grokbot already exists");
      expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    });

    it("puts the scopes back and shows the error when the scope change fails", async () => {
      // Arrange
      const a = agent();
      mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [a] } }),
        [`PATCH /api/agents/${a.id}`]: () => ({ status: 500, body: { error: "database unavailable" } }),
      });
      render(<AgentsSettings />);
      const archive = await screen.findByRole("checkbox", { name: "Grokbot: jobs:archive" });

      // Act
      fireEvent.click(archive);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
      expect(archive).not.toBeChecked();
    });

    it("keeps the agent active and shows the error when revoking fails", async () => {
      // Arrange
      const a = agent();
      mockApi({
        "GET /api/agents": () => ({ status: 200, body: { agents: [a] } }),
        [`POST /api/agents/${a.id}/revoke`]: () => ({ status: 500, body: { error: "database unavailable" } }),
      });
      vi.stubGlobal("confirm", vi.fn(() => true));
      render(<AgentsSettings />);

      // Act
      fireEvent.click(await screen.findByRole("button", { name: "Revoke Grokbot" }));

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
      expect(screen.queryByText("Revoked")).not.toBeInTheDocument();
    });
  });
});
