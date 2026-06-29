#!/usr/bin/env node
/**
 * Automated WebSearch job search pass for deckhandAI.
 *
 * Reads websearch_passes from data/config.json, searches each query,
 * uses your configured AI provider to extract qualifying roles, deduplicates
 * against existing jobs, and writes new entries to the pending queue in your
 * GitHub data repo.
 *
 * Works with any OpenAI-compatible AI provider.
 *
 * Required env vars:
 *   AI_API_KEY          — your AI provider API key
 *   AI_MODEL            — model to use (e.g. gemini-2.0-flash, gpt-4o-mini)
 *   GITHUB_TOKEN        — PAT with write access to your data repo
 *   GITHUB_DATA_REPO    — e.g. your-org/your-private-repo
 *   GITHUB_DATA_BRANCH  — e.g. main
 *
 * Optional:
 *   AI_BASE_URL          — base URL for OpenAI-compatible endpoint
 *                          (defaults to https://api.openai.com/v1)
 *   BRAVE_SEARCH_API_KEY — Brave Search API key (recommended for reliable results)
 *                          Falls back to DuckDuckGo if not set.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../data/config.json");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    console.error("Could not read data/config.json — copy data/config.sample.json to get started.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

async function githubGet(repo, branch, path) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "deckhandAI/job-search",
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
      "User-Agent": "deckhandAI/job-search",
    },
    body: JSON.stringify({ message, content, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Search backends
// ---------------------------------------------------------------------------

async function search(query) {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return searchBrave(query);
  }
  console.log("  (No BRAVE_SEARCH_API_KEY — falling back to DuckDuckGo)");
  return searchDuckDuckGo(query);
}

async function searchBrave(query) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
    },
  });
  if (!res.ok) throw new Error(`Brave Search: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description ?? "",
  }));
}

async function searchDuckDuckGo(query) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; deckhandAI/1.0; +https://github.com/creativereason/deckhandAI)",
    },
  });
  if (!res.ok) throw new Error(`DuckDuckGo: ${res.status}`);
  const html = await res.text();

  const results = [];
  // DuckDuckGo lite renders plain <a href="https://..."> links for results
  const linkRegex = /<a[^>]+href="(https?:\/\/(?!.*duckduckgo\.com)[^"]+)"[^>]*>([^<]{5,150})<\/a>/g;
  let match;
  const seen = new Set();
  while ((match = linkRegex.exec(html)) !== null) {
    const [, resultUrl, title] = match;
    if (!seen.has(resultUrl)) {
      seen.add(resultUrl);
      results.push({ title: title.trim(), url: resultUrl, description: "" });
    }
  }
  return results.slice(0, 20);
}

// ---------------------------------------------------------------------------
// AI filtering
// ---------------------------------------------------------------------------

async function filterWithAI(results, preferences, query) {
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  const prompt = `You are helping filter job search results for a candidate.

Candidate preferences:
- Target titles: ${preferences.titles.join(", ")}
- Min FTE salary: $${preferences.salary.min_fte.toLocaleString()}
- Min contract hourly: $${preferences.salary.min_contract_hourly}/hr
- Open to contract: ${preferences.open_to_contract}
- Remote OK: ${preferences.locations.remote}
- Hybrid OK: ${preferences.locations.hybrid}
- Hub city: ${preferences.locations.hub_city}, ${preferences.locations.hub_state}

Search query used: "${query}"

Search results:
${results.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description}`).join("\n\n")}

From these results, extract any that appear to be active job listings matching the candidate's seniority level and preferences. Ignore results that are clearly not job listings (blog posts, news articles, company homepages).

Return a JSON array only, no other text. Each item: { "company": "", "role": "", "url": "", "salary": "", "notes": "" }
Return [] if nothing qualifies.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error(`AI API: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.choices[0].message.content.trim();

  try {
    return JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, ""));
  } catch {
    console.warn("  Could not parse AI response as JSON:", text.slice(0, 200));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const required = ["GITHUB_TOKEN", "GITHUB_DATA_REPO", "GITHUB_DATA_BRANCH", "AI_API_KEY", "AI_MODEL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const { GITHUB_DATA_REPO, GITHUB_DATA_BRANCH } = process.env;

  const config = loadConfig();
  const { preferences, websearch_passes } = config;

  if (!websearch_passes || Object.keys(websearch_passes).length === 0) {
    console.error("No websearch_passes defined in data/config.json — nothing to search.");
    process.exit(1);
  }

  console.log(`Loading jobs from ${GITHUB_DATA_REPO}...`);
  const { data: jobs, sha } = await githubGet(GITHUB_DATA_REPO, GITHUB_DATA_BRANCH, "data/jobs.json");

  const existingUrls = new Set(
    Object.values(jobs)
      .filter(Array.isArray)
      .flat()
      .map((j) => j.url)
      .filter(Boolean)
  );

  console.log(`${existingUrls.size} existing job URLs loaded for deduplication.`);

  const today = new Date().toISOString().slice(0, 10);
  const newJobs = [];

  for (const [group, queries] of Object.entries(websearch_passes)) {
    console.log(`\nGroup: ${group} (${queries.length} quer${queries.length === 1 ? "y" : "ies"})`);

    for (const { query, scrapeGroup } of queries) {
      console.log(`  Query: ${query}`);

      let results;
      try {
        results = await search(query);
        console.log(`  ${results.length} results returned`);
      } catch (err) {
        console.warn(`  Search failed: ${err.message}`);
        continue;
      }

      if (results.length === 0) continue;

      let extracted;
      try {
        extracted = await filterWithAI(results, preferences, query);
      } catch (err) {
        console.warn(`  AI filtering failed: ${err.message}`);
        continue;
      }

      for (const job of extracted) {
        if (!job.url || existingUrls.has(job.url)) continue;
        existingUrls.add(job.url);
        newJobs.push({
          company: job.company ?? "",
          role: job.role ?? "",
          url: job.url,
          salary: job.salary ?? "",
          notes: job.notes ?? "",
          scrapeGroup: scrapeGroup ?? "remote",
          scrapeDate: today,
        });
        console.log(`  + ${job.company} — ${job.role}`);
      }
    }
  }

  if (newJobs.length === 0) {
    console.log("\nNo new qualifying jobs found.");
    return;
  }

  if (!Array.isArray(jobs.pending)) jobs.pending = [];
  jobs.pending.push(...newJobs);

  console.log(`\nWriting ${newJobs.length} new job(s) to ${GITHUB_DATA_REPO}...`);
  await githubPut(
    GITHUB_DATA_REPO,
    GITHUB_DATA_BRANCH,
    "data/jobs.json",
    sha,
    jobs,
    `Add ${newJobs.length} job${newJobs.length === 1 ? "" : "s"} to pending queue via WebSearch pass`
  );

  console.log(`Done. ${newJobs.length} new job(s) added to pending queue.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
