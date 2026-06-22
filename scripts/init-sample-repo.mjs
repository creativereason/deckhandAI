#!/usr/bin/env node
/**
 * Creates a new GitHub repo pre-populated with sample data for deckhandAI.
 *
 * Usage:
 *   node scripts/init-sample-repo.mjs
 *
 * You'll be prompted for:
 *   - Your GitHub personal access token (needs 'repo' scope)
 *   - The repo name to create (e.g. "my-job-tracker-data")
 *   - Whether to make it private (default: yes)
 */

import { createInterface } from "readline";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

function ask(rl, question) {
  return new Promise((res) => rl.question(question, res));
}

async function githubPost(token, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? `GitHub API error ${res.status}`);
  return json;
}

async function githubPut(token, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+gjson",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? `GitHub API error ${res.status}`);
  return json;
}

async function getUser(token) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Could not fetch GitHub user");
  return json;
}

function encodeFile(path) {
  return Buffer.from(readFileSync(path, "utf8")).toString("base64");
}

const FILES = [
  { src: "data/jobs.sample.json",            dest: "data/jobs.json" },
  { src: "data/config.sample.json",          dest: "data/config.json" },
  { src: "data/profile.sample.json",         dest: "data/profile.json" },
  { src: "data/scrape-targets.sample.json",  dest: "data/scrape-targets.json" },
];

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\ndeckhandAI — Sample Data Repo Init\n");
  console.log("This script creates a new GitHub repo pre-populated with sample data.");
  console.log("Use it as your data repo for a demo or as a starting template.\n");

  const token   = (await ask(rl, "GitHub personal access token (repo scope): ")).trim();
  const repoName = (await ask(rl, "New repo name (e.g. deckhandai-data): ")).trim() || "deckhandai-data";
  const privateStr = (await ask(rl, "Make it private? [Y/n]: ")).trim().toLowerCase();
  const isPrivate  = privateStr !== "n";

  rl.close();

  if (!token) { console.error("Token is required."); process.exit(1); }

  console.log("\nFetching GitHub user...");
  const user = await getUser(token);
  const owner = user.login;
  console.log(`  Logged in as: ${owner}`);

  console.log(`\nCreating repo: ${owner}/${repoName} (${isPrivate ? "private" : "public"})...`);
  const repo = await githubPost(token, "/user/repos", {
    name: repoName,
    private: isPrivate,
    description: "deckhandAI data repo — job tracker and AI document generation",
    auto_init: true,
  });
  console.log(`  Created: ${repo.html_url}`);

  // Wait a moment for the init commit to settle
  await new Promise((r) => setTimeout(r, 1500));

  console.log("\nUploading sample data files...");
  for (const f of FILES) {
    const content = encodeFile(resolve(root, f.src));
    try {
      await githubPut(token, `/repos/${owner}/${repoName}/contents/${f.dest}`, {
        message: `init: add sample ${f.dest}`,
        content,
      });
      console.log(`  ✓  ${f.dest}`);
    } catch (err) {
      console.error(`  ✗  ${f.dest} — ${err.message}`);
    }
  }

  console.log(`
Done! Your data repo is ready: ${repo.html_url}

Next steps:
  1. Add these env vars to your deckhandAI deployment:
       GITHUB_TOKEN=<your token>
       GITHUB_DATA_REPO=${owner}/${repoName}

  2. Customize data/config.json with your name, location, and preferences.
  3. Fill in data/profile.json with your real work history (used for AI generation).
  4. Edit data/scrape-targets.json to point at companies you want to track.

To run the app locally:
  pnpm dev    → http://localhost:3000
`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
