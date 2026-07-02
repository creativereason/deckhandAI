#!/usr/bin/env node
/**
 * Resets the public demo data repo back to its committed sample content.
 *
 * The live demo (DEMO_MODE=true, no login) writes real jobs/config/profile
 * data into a public GitHub data repo so visitors can try the app. This
 * script overwrites that repo's data files with data/*.sample.json on a
 * nightly schedule (see .github/workflows/reset-demo.yml) so the shared,
 * unauthenticated demo doesn't drift or accumulate junk indefinitely.
 *
 * Usage:
 *   node scripts/reset-demo-repo.mjs
 *
 * Required env vars:
 *   DEMO_DATA_REPO        "owner/repo" — the public demo data repo
 *   DEMO_DATA_REPO_TOKEN  GitHub token with write access to that repo
 *   DEMO_DATA_BRANCH      optional, defaults to "main"
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { SAMPLE_DATA_FILES } from "./lib/sample-data-files.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const repo = process.env.DEMO_DATA_REPO;
const token = process.env.DEMO_DATA_REPO_TOKEN;
const branch = process.env.DEMO_DATA_BRANCH || "main";

if (!repo) throw new Error("DEMO_DATA_REPO is required (e.g. yourhandle/deckhandai-sample-data)");
if (!token) throw new Error("DEMO_DATA_REPO_TOKEN is required");

const BASE = `https://api.github.com/repos/${repo}/contents`;
const HEADERS = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function currentSha(path) {
  const res = await fetch(`${BASE}/${path}?ref=${branch}`, { headers: HEADERS });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub read error ${res.status}: ${await res.text()}`);
  return (await res.json()).sha;
}

async function resetFile({ src, dest }) {
  const content = readFileSync(resolve(root, src), "utf8");
  const sha = await currentSha(dest);
  const res = await fetch(`${BASE}/${dest}`, {
    method: "PUT",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "chore: nightly demo data reset",
      content: Buffer.from(content).toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`GitHub write error for ${dest} (${res.status}): ${await res.text()}`);
  console.log(`  reset ${dest}`);
}

async function main() {
  console.log(`Resetting demo data repo ${repo}@${branch}...`);
  for (const file of SAMPLE_DATA_FILES) {
    await resetFile(file);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
