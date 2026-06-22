import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  authenticated: boolean;
}

export const SESSION_OPTIONS = {
  password: process.env.COOKIE_SECRET as string,
  cookieName: "__session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}
