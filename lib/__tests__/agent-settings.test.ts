import { describe, expect, it } from "vitest";
import { toggleScope } from "@/lib/agent-settings";

describe("toggleScope", () => {
  it("returns a list holding only the scope when toggled on an empty list", () => {
    // Arrange
    const scopes: never[] = [];

    // Act
    const next = toggleScope(scopes, "jobs:read");

    // Assert
    expect(next).toEqual(["jobs:read"]);
  });

  it("removes the scope when it is already granted", () => {
    // Arrange
    const scopes = ["jobs:read", "jobs:edit"] as const;

    // Act
    const next = toggleScope(scopes, "jobs:edit");

    // Assert
    expect(next).toEqual(["jobs:read"]);
  });

  it("returns scopes in AGENT_SCOPES order regardless of the order they were toggled on", () => {
    // Arrange
    const scopes = ["jobs:archive", "jobs:read"] as const;

    // Act
    const next = toggleScope(scopes, "jobs:add_pending");

    // Assert
    expect(next).toEqual(["jobs:read", "jobs:add_pending", "jobs:archive"]);
  });

  describe("when the scope is the only one granted", () => {
    it("keeps it, because the server rejects an agent with no scopes", () => {
      // Arrange
      const scopes = ["jobs:read"] as const;

      // Act
      const next = toggleScope(scopes, "jobs:read");

      // Assert
      expect(next).toEqual(["jobs:read"]);
    });
  });
});
