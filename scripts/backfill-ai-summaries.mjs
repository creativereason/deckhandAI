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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

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
// GitHub API (same shape as scripts/job-search.mjs)
// ---------------------------------------------------------------------------

async function githubGet(repo, branch, path) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "deckhandAI/backfill-ai-summaries",
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`);
  const { content, sha } = await res.json();
  return { data: JSON.parse(Buffer.from(content, "base64").toString("utf8")), sha };
}

async function githubPut(repo, branch, path, sha, data, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "deckhandAI/backfill-ai-summaries",
    },
    body: JSON.stringify({ message, content, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);
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
  const provider = process.env.AI_PROVIDER || "anthropic";
  const model = process.env.AI_MODEL || "claude-sonnet-4-6";
  const apiKey = process.env.AI_API_KEY || "";

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(job) }],
      }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  }

  const builtinBase = {
    openai: "https://api.openai.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    grok: "https://api.x.ai/v1",
  };
  const baseUrl = process.env.AI_BASE_URL || builtinBase[provider] || "https://api.openai.com/v1";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(job) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
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
  const { data: jobs, sha } = await githubGet(repo, branch, "data/jobs.json");

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

  await githubPut(repo, branch, "data/jobs.json", sha, jobs, `Backfill aiSummary for ${generated} jobs`);
  console.log(`Wrote data/jobs.json to ${repo}@${branch}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
