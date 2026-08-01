#!/usr/bin/env node
/**
 * Email digest ingestion pass for deckhandAI.
 *
 * Reads a batch of already-exported emails (job-alert digests from services
 * like Indeed, TheLadders, or Lensa), uses your configured AI provider to
 * extract any qualifying job listings against your data/config.json
 * preferences, deduplicates against existing jobs, and writes new entries to
 * the pending queue in your GitHub data repo.
 *
 * This script has no idea where the emails came from — it only knows the
 * input shape below. Any tool that can export emails in that shape can feed
 * it: a Gmail export, an IMAP fetch script, an mbox parser, or (as one
 * example) an OpenClaw `gog`-based Gmail triage job. See
 * docs/scheduled-job-search.md for a worked OpenClaw wiring example.
 *
 * Input (JSON array), via --input <file> or stdin:
 *   [{ "id": "...", "subject": "...", "from": "...", "receivedAt": "...", "body": "..." }]
 *
 * Usage:
 *   node scripts/email-job-search.mjs --input emails.json
 *   cat emails.json | node scripts/email-job-search.mjs
 *
 * Required env vars:
 *   AI_API_KEY          — your AI provider API key
 *   GITHUB_TOKEN        — PAT with write access to your data repo
 *   GITHUB_DATA_REPO    — e.g. your-org/your-private-repo
 *   GITHUB_DATA_BRANCH  — e.g. main
 *
 * Optional:
 *   AI_PROVIDER — anthropic (default) | openai | gemini | grok | ollama | custom
 *   AI_MODEL    — model to use (default: claude-sonnet-4-6)
 *   AI_BASE_URL — base URL for OpenAI-compatible endpoints; ignored for
 *                 AI_PROVIDER=anthropic (native Messages API instead).
 *                 Defaults per provider, falling back to
 *                 https://api.openai.com/v1
 *
 * On success, prints one JSON summary object to stdout:
 *   { "processed": 12, "added": [...], "skippedDuplicate": [...], "skippedNoMatch": [...] }
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { githubGet, githubPut } from "./lib/github-contents.mjs";
import { callAI } from "./lib/ai-provider.mjs";
import { jobKey } from "./lib/job-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../data/config.json");
const USER_AGENT = "deckhandAI/email-job-search";

// ---------------------------------------------------------------------------
// Config + input
// ---------------------------------------------------------------------------

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    console.error("Could not read data/config.json — copy data/config.sample.json to get started.");
    process.exit(1);
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function loadEmails() {
  const inputFlagIndex = process.argv.indexOf("--input");
  const raw =
    inputFlagIndex !== -1 && process.argv[inputFlagIndex + 1]
      ? readFileSync(process.argv[inputFlagIndex + 1], "utf8")
      : await readStdin();

  let emails;
  try {
    emails = JSON.parse(raw);
  } catch {
    console.error("Could not parse input as JSON — expected an array of email objects.");
    process.exit(1);
  }
  if (!Array.isArray(emails)) {
    console.error("Input must be a JSON array of email objects.");
    process.exit(1);
  }
  return emails;
}

// ---------------------------------------------------------------------------
// AI extraction + filtering (one call per email — digests often list several roles)
// ---------------------------------------------------------------------------

async function extractQualifyingJobs(email, preferences) {
  const prompt = `You are helping filter a job-alert email for a candidate. Be strict — reject a
listing whenever it's unclear or ambiguous, rather than including it on the hope it might fit.
False positives cost the candidate real time reviewing bad matches; a missed listing costs
nothing since it stays in the source digest.

Candidate preferences:
- Target titles: ${preferences.titles.join(", ")}
- Min FTE salary: $${preferences.salary.min_fte.toLocaleString()}
- Min contract hourly: $${preferences.salary.min_contract_hourly}/hr
- Open to contract: ${preferences.open_to_contract}
- Remote OK: ${preferences.locations.remote}
- Hybrid OK: ${preferences.locations.hybrid}
- Local OK: within ${preferences.locations.hub_radius_miles} miles of ${preferences.locations.hub_city}, ${preferences.locations.hub_state}

Email subject: "${email.subject}"
Email from: ${email.from}
Email body:
${email.body}

This email may be a job-alert digest listing multiple postings (e.g. from Indeed, TheLadders, or
Lensa), a single-posting alert, or not a job alert at all. For each listing, apply every rule
below — a listing only qualifies if it passes all of them:

1. Title: the role must closely match one of the target titles above, at the same seniority
   tier and same discipline. Reject IC-level or junior/mid titles when the target list is
   director/head/VP/principal-tier, and reject listings in an unrelated discipline (e.g. interior
   design, motion/multimedia design, marketing) even if the word "design" or "designer" appears
   in the title. A near-miss title in the wrong discipline is not a match.
2. Salary: if a salary or rate is stated, it must meet the FTE or contract floor above (whichever
   applies). If no salary is stated, only include the listing if everything else is a clear
   strong match — do not assume an unstated salary meets the floor.
3. Location: must be explicitly remote, explicitly hybrid, or within the local radius above.
   Vague location text ("Virtual / Travel", "Various", unspecified) does not count as remote —
   treat it as on-site/unclear and reject unless the listing separately confirms remote/hybrid
   eligibility.
4. Not a listing at all: ignore anything that isn't an actual job posting (ads, "don't miss out"
   footers, unsubscribe/preference links, unrelated content).

Return a JSON array only, no other text. Each item: { "company": "", "role": "", "url": "", "salary": "", "notes": "" }
The "notes" field must briefly state why it passed all four rules (e.g. "Director-level UX role,
$190K remote — matches title/salary/location"). Return [] if nothing in this email clearly
qualifies.`;

  const text = (await callAI({ userPrompt: prompt, temperature: 0 })).trim();

  try {
    return JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, ""));
  } catch {
    console.warn(`  Could not parse AI response as JSON for "${email.subject}":`, text.slice(0, 200));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const required = ["GITHUB_TOKEN", "GITHUB_DATA_REPO", "GITHUB_DATA_BRANCH", "AI_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const { GITHUB_DATA_REPO, GITHUB_DATA_BRANCH } = process.env;

  const config = loadConfig();
  const { preferences } = config;
  const emails = await loadEmails();

  if (emails.length === 0) {
    console.log(JSON.stringify({ processed: 0, added: [], skippedDuplicate: [], skippedNoMatch: [] }));
    return;
  }

  console.error(`Loading jobs from ${GITHUB_DATA_REPO}...`);
  const { data: jobs, sha } = await githubGet(GITHUB_DATA_REPO, GITHUB_DATA_BRANCH, "data/jobs.json", USER_AGENT);

  const existingJobs = Object.values(jobs).filter(Array.isArray).flat();
  const existingUrls = new Set(existingJobs.map((j) => j.url).filter(Boolean));
  const existingKeys = new Set(existingJobs.map((j) => jobKey(j.company ?? "", j.role ?? "")));

  console.error(`${existingUrls.size} existing job URLs loaded for deduplication.`);

  const today = new Date().toISOString().slice(0, 10);
  const added = [];
  const skippedDuplicate = [];
  const skippedNoMatch = [];

  for (const email of emails) {
    console.error(`Email: "${email.subject}" from ${email.from}`);

    let extracted;
    try {
      extracted = await extractQualifyingJobs(email, preferences);
    } catch (err) {
      console.error(`  AI extraction failed: ${err.message}`);
      continue;
    }

    if (extracted.length === 0) {
      skippedNoMatch.push({ emailId: email.id, subject: email.subject });
      continue;
    }

    for (const job of extracted) {
      if (!job.url) continue;
      const key = jobKey(job.company ?? "", job.role ?? "");
      if (existingUrls.has(job.url) || existingKeys.has(key)) {
        skippedDuplicate.push({ company: job.company, role: job.role, url: job.url });
        continue;
      }
      existingUrls.add(job.url);
      existingKeys.add(key);
      const pendingJob = {
        company: job.company ?? "",
        role: job.role ?? "",
        url: job.url,
        salary: job.salary ?? "",
        notes: job.notes ?? "",
        scrapeGroup: "remote",
        scrapeDate: today,
      };
      added.push(pendingJob);
      console.error(`  + ${pendingJob.company} — ${pendingJob.role}`);
    }
  }

  if (added.length > 0) {
    if (!Array.isArray(jobs.pending)) jobs.pending = [];
    jobs.pending.push(...added);

    console.error(`Writing ${added.length} new job(s) to ${GITHUB_DATA_REPO}...`);
    await githubPut(
      GITHUB_DATA_REPO,
      GITHUB_DATA_BRANCH,
      "data/jobs.json",
      sha,
      jobs,
      `Add ${added.length} job${added.length === 1 ? "" : "s"} to pending queue via email digest ingestion`,
      USER_AGENT
    );
  }

  console.log(JSON.stringify({ processed: emails.length, added, skippedDuplicate, skippedNoMatch }));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
