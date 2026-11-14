import { describe, expect, it } from "vitest";
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, hasScope, isAgentScope } from "@/lib/agent-scopes";

describe("agent scopes", () => {
  // O — One: the documented set, no more and no less
  it("offers exactly the seven documented scopes", () => {
    expect([...AGENT_SCOPES].sort()).toEqual([
      "jobs:add_pending", "jobs:archive", "jobs:check_url", "jobs:edit", "jobs:evaluate", "jobs:read", "jobs:triage",
    ]);
  });

  // B — Boundary: new agents start narrow; everything else is granted on purpose
  it("gives a new agent only read and add-to-pending by default", () => {
    expect([...DEFAULT_AGENT_SCOPES].sort()).toEqual(["jobs:add_pending", "jobs:read"]);
  });

  it("recognizes a scope by name and rejects anything else", () => {
    expect(isAgentScope("jobs:read")).toBe(true);
    expect(isAgentScope("jobs:delete")).toBe(false);
    expect(isAgentScope("")).toBe(false);
  });

  // I — Interface: scopes are independent, so holding one never implies another
  it("checks each scope on its own", () => {
    const agent = { scopes: ["jobs:read"] as const };

    expect(hasScope(agent, "jobs:read")).toBe(true);
    expect(hasScope(agent, "jobs:add_pending")).toBe(false);
    expect(hasScope(agent, "jobs:archive")).toBe(false);
  });
});
