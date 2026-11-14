import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type SessionData } from "@/lib/auth";
import { cookies } from "next/headers";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

/**
 * Agent routes authenticate with their own Bearer key and scopes (lib/agent-auth.ts
 * `withAgent`), not a browser session, so the session check below does not apply to them.
 * Every route under these prefixes MUST be wrapped in withAgent: this carve-out makes the
 * proxy stop protecting them. The match is exact on purpose: `/api/agent/` needs its trailing
 * slash so `/api/agents` (the admin routes that create and revoke keys) stays session-only.
 */
function isAgentRoute(pathname: string): boolean {
  return pathname.startsWith("/api/agent/") || pathname === "/api/mcp" || pathname.startsWith("/api/mcp/");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets through
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    isAgentRoute(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|otf|js|css|map)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Demo mode bypasses auth entirely
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.next();
  }

  const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);

  if (!session.authenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
