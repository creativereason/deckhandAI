import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIronSession } from "iron-session";
import { proxy } from "@/proxy";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("iron-session", () => ({ getIronSession: vi.fn() }));

const signedIn = (authenticated: boolean) =>
  vi.mocked(getIronSession).mockResolvedValue({ authenticated } as unknown as Awaited<ReturnType<typeof getIronSession>>);
const visit = (path: string) => proxy(new NextRequest(`http://localhost${path}`));
const isLoginRedirect = (res: Response) => res.status === 307 && (res.headers.get("location") ?? "").includes("/login");
// NextResponse.next() marks itself with this header; anything else is a redirect or a block.
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  vi.mocked(getIronSession).mockReset();
  delete process.env.DEMO_MODE;
  signedIn(false);
});

describe("proxy: browser session", () => {
  // B — Boundary: everything that is not carved out still needs a signed-in session
  it.each(["/", "/api/jobs", "/api/agents", "/api/config", "/settings/agents", "/job"])("redirects %s to login without a session", async (path) => {
    expect(isLoginRedirect(await visit(path))).toBe(true);
  });

  it("lets a signed-in session through", async () => {
    signedIn(true);

    expect(passedThrough(await visit("/api/jobs"))).toBe(true);
  });

  it("leaves the login page and static files open", async () => {
    expect(passedThrough(await visit("/login"))).toBe(true);
    expect(passedThrough(await visit("/_next/static/chunk.js"))).toBe(true);
  });
});

describe("proxy: agent API carve-out", () => {
  // O — One: agent routes authenticate with their own key, so the browser-session check is skipped
  it.each(["/api/agent/v1/jobs", "/api/agent/v1/jobs/abc/move", "/api/mcp", "/api/mcp/sse"])("lets %s through without a browser session", async (path) => {
    expect(passedThrough(await visit(path))).toBe(true);
    expect(getIronSession).not.toHaveBeenCalled();
  });

  // E — Exception: the carve-out is exact. Look-alikes stay behind the session.
  it.each([
    "/api/agents", // admin routes that create and revoke keys: must NEVER be open to agent keys
    "/api/agents/7f1c2f0e-3c1d-4b8e-9a52-1f0a5d6c7e11/revoke",
    "/api/agent", // no trailing slash
    "/api/agentx/v1/jobs",
    "/api/agent-admin",
    "/api/mcpx",
    "/api/mcp-admin",
    "/api/agent%2Fv1/jobs", // an encoded slash is not a path separator here
    "/x/api/agent/v1/jobs",
    "/api/jobs/api/agent/",
  ])("keeps %s behind the session", async (path) => {
    expect(isLoginRedirect(await visit(path))).toBe(true);
  });

  it("does not let dot segments walk out of the carve-out into a protected route", async () => {
    // The URL parser resolves this to /api/jobs before the proxy sees it.
    expect(isLoginRedirect(await visit("/api/agent/../jobs"))).toBe(true);
  });
});
