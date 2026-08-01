#!/usr/bin/env node
/**
 * One-time backfill of the aiSummary field (M14) for existing boards.
 *
 * Reads jobs.json from your GitHub data repo, generates a 1–2 sentence
 * "at a glance" summary for every job that doesn't have one yet, and
 * writes the result back in a single commit. Safe to re-run: jobs that
 * already have an aiSummary are skipped, and jobs with no notes to
 * summarize are left untouched (a summary invented from just company +
 * role would be hallucination, not extraction).
 *
 * New jobs added through the app get aiSummary automatically — this
 * script exists only to bring pre-M14 boards up to date.
 *
 * Usage:
 *   node scripts/backfill-ai-summaries.mjs [--dry-run]
 *
 * Required env vars (read from .env.local if present):
 *   AI_API_KEY          — your AI provider API key (not needed for Ollama)
 *   GITHUB_TOKEN        — PAT with write access to your data repo
 *   GITHUB_DATA_REPO    — e.g. your-org/your-private-repo
 *
 * Optional:
 *   GITHUB_DATA_BRANCH  — branch to read/write (default: main)
 *   AI_PROVIDER         — anthropic | openai | ollama | gemini | grok | custom (default: anthropic)
 *   AI_MODEL            — model name (default: claude-sonnet-4-6)
 *   AI_BASE_URL         — base URL for OpenAI-compatible endpoints
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { githubGet, githubPut } from "./lib/github-contents.mjs";
import { callAI } from "./lib/ai-provider.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const USER_AGENT = "deckhandAI/backfill-ai-summaries";

// ---------------------------------------------------------------------------
// Env (.env.local convenience — existing env always wins)
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  const envPath = resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

// ---------------------------------------------------------------------------
// AI call — endpoint resolution mirrors lib/model.ts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "You write a 1–2 sentence at-a-glance summary of a job posting: what the role is (scope, team, key responsibilities) and what the company does. Plain text only — no preamble, no quotes, no markdown, no fit assessment.";

function buildUserPrompt(job) {
  return `Summarize this job in 1–2 sentences.

Company: ${job.company}
Role: ${job.role}
Salary: ${job.salary || "not listed"}

NOTES:
${job.notes}`;
}

async function generateSummary(job) {
  return callAI({ systemPrompt: SYSTEM_PROMPT, userPrompt: buildUserPrompt(job), maxTokens: 300 });
}

// Same cleanup rules as normalizeAiSummary in lib/job-summary.ts — keep in sync.
function normalizeAiSummary(raw) {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/```[a-z]*\s*/gi, "")
    .replace(/[*_]{1,3}/g, "")
    .replace(/^\s*["'“‘]+|["'”’]+\s*$/g, "")
    .replace(/^\s*summary\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[a-z0-9]/i.test(cleaned)) return "";
  return cleaned.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SECTIONS = ["applied", "prospect", "local", "staffing", "passed", "pending"];

async function main() {
  loadEnvLocal();

  const repo = process.env.GITHUB_DATA_REPO;
  const branch = process.env.GITHUB_DATA_BRANCH || "main";
  if (!repo || !process.env.GITHUB_TOKEN) {
    console.error("GITHUB_DATA_REPO and GITHUB_TOKEN are required (set them in .env.local).");
    process.exit(1);
  }
  const provider = process.env.AI_PROVIDER || "anthropic";
  if (!process.env.AI_API_KEY && provider !== "ollama") {
    console.error("AI_API_KEY is required (set it in .env.local), or set AI_PROVIDER=ollama.");
    process.exit(1);
  }

  console.log(`Reading data/jobs.json from ${repo}@${branch}…`);
  const { data: jobs, sha } = await githubGet(repo, branch, "data/jobs.json", USER_AGENT);

  let generated = 0;
  let skippedExisting = 0;
  let skippedNoNotes = 0;

  for (const section of SECTIONS) {
    for (const job of jobs[section] ?? []) {
      if (job.aiSummary) {
        skippedExisting++;
        continue;
      }
      if (!job.notes || !job.notes.trim()) {
        skippedNoNotes++;
        console.log(`  ~ ${section}: ${job.company} — ${job.role} (no notes to summarize, skipped)`);
        continue;
      }
      try {
        const summary = normalizeAiSummary(await generateSummary(job));
        if (!summary) {
          console.log(`  ~ ${section}: ${job.company} — ${job.role} (provider returned nothing usable, skipped)`);
          continue;
        }
        job.aiSummary = summary;
        generated++;
        console.log(`  ✓ ${section}: ${job.company} — ${job.role}`);
        console.log(`      ${summary}`);
      } catch (err) {
        console.error(`  ✗ ${section}: ${job.company} — ${job.role}: ${err.message}`);
      }
    }
  }

  console.log(
    `\n${generated} summaries generated, ${skippedExisting} already had one, ${skippedNoNotes} had no notes.`
  );

  if (generated === 0) {
    console.log("Nothing to write.");
    return;
  }
  if (DRY_RUN) {
    console.log("Dry run — no changes written.");
    return;
  }

  await githubPut(repo, branch, "data/jobs.json", sha, jobs, `Backfill aiSummary for ${generated} jobs`, USER_AGENT);
  console.log(`Wrote data/jobs.json to ${repo}@${branch}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
