import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// proxy.ts does not check the browser session for these prefixes, so each route's own
// withAgent wrapper is the only thing between the internet and the board. This fails the
// build if a handler is exported any other way.
const ROOTS = ["app/api/agent", "app/api/mcp"];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function routeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return /^route\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = ROOTS.flatMap((root) => routeFiles(join(process.cwd(), root)));

describe("agent routes are all behind withAgent", () => {
  it("finds the agent API routes (so this test cannot pass by scanning nothing)", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files.map((file) => [file.replace(process.cwd() + "/", ""), readFileSync(file, "utf8")]))("%s", (_name, source) => {
    const handlerLines = source.split("\n").filter((line) => new RegExp(`^export\\s+(const|async function|function)\\s+(${HTTP_METHODS.join("|")})\\b`).test(line));

    const unguarded = handlerLines.filter((line) => !/^export const \w+ = withAgent/.test(line));

    expect(handlerLines.length).toBeGreaterThan(0);
    expect(unguarded).toEqual([]);
  });
});
