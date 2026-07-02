import { readFileSync } from "fs";
import { resolve } from "path";

// scripts/screenshots.mjs spawns a local dev server with DEMO_MODE=true and an
// explicit DEMO_PERSONA to capture marketing screenshots offline, without a
// GitHub-backed data repo. The public live demo also sets DEMO_MODE=true, but
// points GITHUB_DATA_REPO at a real (public) data repo and leaves DEMO_PERSONA
// unset, so it reads/writes through the normal GitHub-backed path instead.
export function usesLocalDemoFixtures(): boolean {
  return process.env.DEMO_MODE === "true" && !!process.env.DEMO_PERSONA;
}

function personaSampleFile(base: string): string {
  const persona = process.env.DEMO_PERSONA;
  return persona === "dev" || persona === "onboarding"
    ? `data/${base}-${persona}.sample.json`
    : `data/${base}.sample.json`;
}

// dataPath is the canonical "data/<name>.json" path lib/github.ts reads/writes
// against a real data repo (e.g. "data/jobs.json").
export function readLocalDemoFixtureRaw(dataPath: string): string {
  const base = dataPath.replace(/^data\//, "").replace(/\.json$/, "");
  try {
    return readFileSync(resolve(process.cwd(), personaSampleFile(base)), "utf-8");
  } catch {
    return "{}";
  }
}
