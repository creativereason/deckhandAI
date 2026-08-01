// Shared GitHub Contents API read/write helpers for the data-repo JSON files
// (data/jobs.json, data/config.json). Used by any script that reads or
// writes the private data repo directly (scripts/job-search.mjs,
// scripts/backfill-ai-summaries.mjs, scripts/email-job-search.mjs) so the
// GET-then-sha-guarded-PUT contract only lives in one place.
//
// Requires GITHUB_TOKEN in the environment; callers are responsible for
// validating it's set before calling.

export async function githubGet(repo, branch, path, userAgent) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "User-Agent": userAgent,
    },
  });
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`);
  const { content, sha } = await res.json();
  return { data: JSON.parse(Buffer.from(content, "base64").toString("utf8")), sha };
}

export async function githubPut(repo, branch, path, sha, data, message, userAgent) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({ message, content, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);
}
