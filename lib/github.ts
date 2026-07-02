import { usesLocalDemoFixtures, readLocalDemoFixtureRaw } from "@/lib/demo-fixtures";

const DATA_REPO = process.env.GITHUB_DATA_REPO!; // "owner/repo"
const TOKEN = process.env.GITHUB_TOKEN!;
const BRANCH = process.env.GITHUB_DATA_BRANCH || "main";
const BASE = `https://api.github.com/repos/${DATA_REPO}/contents`;

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

// scripts/screenshots.mjs runs with DEMO_MODE + DEMO_PERSONA to capture
// marketing screenshots, including actions that write (e.g. "Approve all" on
// the pending queue). Those writes must never reach the real, GitHub-backed
// demo repo — so while local fixtures are active, reads/writes are served
// from this in-memory store instead, seeded from data/*.sample.json on first
// read. State lives only for the process lifetime, so nothing needs resetting
// between screenshot runs.
const localFixtureStore = new Map<string, string>();

function readLocalFixture(path: string): string {
  if (!localFixtureStore.has(path)) {
    localFixtureStore.set(path, readLocalDemoFixtureRaw(path));
  }
  return localFixtureStore.get(path)!;
}

export async function githubRead(path: string): Promise<string> {
  if (usesLocalDemoFixtures()) return readLocalFixture(path);

  const res = await fetch(`${BASE}/${path}?ref=${BRANCH}`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub read error ${res.status}: ${await res.text()}`);
  const { content } = await res.json();
  return Buffer.from(content, "base64").toString("utf-8");
}

export async function githubWrite(
  path: string,
  content: string,
  message: string
): Promise<void> {
  if (usesLocalDemoFixtures()) {
    localFixtureStore.set(path, content);
    return;
  }

  const url = `${BASE}/${path}`;
  const getRes = await fetch(`${url}?ref=${BRANCH}`, { headers: HEADERS, cache: "no-store" });
  // 404 means the file doesn't exist yet — create it without a sha
  const sha = getRes.ok ? (await getRes.json()).sha : undefined;

  const encoded = Buffer.from(content).toString("base64");
  const putRes = await fetch(url, {
    method: "PUT",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: encoded, ...(sha ? { sha } : {}), branch: BRANCH }),
  });
  if (!putRes.ok)
    throw new Error(`GitHub write error ${putRes.status}: ${await putRes.text()}`);
}
