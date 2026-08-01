// Mirrors jobKey() in lib/jobs.ts — keep in sync. Used by standalone scripts
// (scripts/email-job-search.mjs, scripts/job-search.mjs) as a company+role
// dedup fallback for sources whose links aren't stable identifiers (e.g.
// TheLadders/Lensa email tracking-redirect URLs, which mint a fresh token
// per send, so the same posting re-appearing in a later digest would not
// match on url alone).
export function jobKey(company, role) {
  return `${company}::${role}`;
}
