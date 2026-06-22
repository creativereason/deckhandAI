import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "APP_PASSWORD not configured" }, { status: 500 });
  }

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getSession();
  session.authenticated = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
