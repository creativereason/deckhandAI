import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export type Parsed<T> = { value: T } | { response: NextResponse };

/**
 * Validates a request body. A missing, malformed or invalid body is the caller's mistake, so
 * it is a 400, never a 500. `error` is a plain string (UIs show it as text) and `issues`
 * carries every failing field path.
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<Parsed<T>> {
  return parseValue(await req.json().catch(() => undefined), schema);
}

/** The same check for a value that did not come from a JSON body, such as a query string. */
export function parseValue<T>(input: unknown, schema: ZodType<T>): Parsed<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { value: parsed.data };
  const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const error = `Invalid request: ${issues.map((i) => `${i.path || "body"} ${i.message}`).join("; ")}`;
  return { response: NextResponse.json({ error, issues }, { status: 400 }) };
}
