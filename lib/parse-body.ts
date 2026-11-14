import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export type Parsed<T> = { value: T } | { response: NextResponse };
export type Checked<T> = { value: T } | { status: 400; body: { error: string; issues: { path: string; message: string }[] } };

/**
 * Validates a value without any HTTP types, so HTTP routes and MCP tools share one rule.
 * `error` is a plain string (UIs show it as text) and `issues` carries every failing field path.
 */
export function checkValue<T>(input: unknown, schema: ZodType<T>): Checked<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { value: parsed.data };
  const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const error = `Invalid request: ${issues.map((i) => `${i.path || "body"} ${i.message}`).join("; ")}`;
  return { status: 400, body: { error, issues } };
}

/** The same check for a value that did not come from a JSON body, such as a query string. */
export function parseValue<T>(input: unknown, schema: ZodType<T>): Parsed<T> {
  const checked = checkValue(input, schema);
  return "value" in checked ? checked : { response: NextResponse.json(checked.body, { status: checked.status }) };
}

/**
 * Validates a request body. A missing, malformed or invalid body is the caller's mistake, so
 * it is a 400, never a 500.
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<Parsed<T>> {
  return parseValue(await req.json().catch(() => undefined), schema);
}
