/**
 * Supabase access for the standalone scripts (scrape-careers, scrape-staffing,
 * job-search, backfill-ai-summaries).
 *
 * Deliberately dependency-free: plain `fetch` against PostgREST, so a bare
 * checkout (a cron box or scheduled agent with no `pnpm install`) can run the
 * scripts. The row mapping below mirrors lib/jobs-mapping.ts;
 * lib/__tests__/scripts-supabase-data.test.ts fails if the two drift.
 */

const SECTIONS = ["applied", "prospect", "local", "staffing", "passed", "pending"];
const PAGE_SIZE = 1000;

const REQUIRED_TEXT = [["company", "company"], ["role", "role"], ["url", "url"], ["salary", "salary"], ["notes", "notes"]];
const OPTIONAL_TEXT = [["aiSummary", "ai_summary"], ["scoreRationale", "score_rationale"]];
const ENUMS = [
  ["status", "status", ["applied", "screening", "interview", "offer", "declined"]],
  ["fit", "fit", ["strong", "good", "caution", "weak"]],
  ["type", "type", ["remote", "hybrid", "local", "contract"]],
  ["scrapeGroup", "scrape_group", ["remote", "local"]],
];
const DATES = [["date", "applied_date"], ["scrapeDate", "scrape_date"]];
const FLAGS = [["isNew", "is_new"], ["isGhost", "is_ghost"]];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when DATA_BACKEND=supabase. Unknown values throw so a typo never silently falls back to GitHub.
 * @param {Record<string, string | undefined>} [env]
 */
export function usesSupabase(env = process.env) {
  const backend = env.DATA_BACKEND || "github";
  if (backend !== "github" && backend !== "supabase") {
    throw new Error(`DATA_BACKEND must be "github" or "supabase", got "${backend}"`);
  }
  return backend === "supabase";
}

function claim(rest, row, key, column, accept) {
  if (!accept(rest[key])) return;
  row[column] = rest[key];
  delete rest[key];
}

const isString = (v) => typeof v === "string";

// Anything without a column is kept in `extra`, so no field is ever dropped.
function toRowFields(rest) {
  const row = { is_new: false, is_ghost: false };
  for (const [key, column] of REQUIRED_TEXT) { row[column] = ""; claim(rest, row, key, column, isString); }
  for (const [key, column] of OPTIONAL_TEXT) { row[column] = null; claim(rest, row, key, column, isString); }
  for (const [key, column, allowed] of ENUMS) { row[column] = null; claim(rest, row, key, column, (v) => isString(v) && allowed.includes(v)); }
  for (const [key, column] of DATES) { row[column] = null; claim(rest, row, key, column, (v) => isString(v) && ISO_DATE.test(v)); }
  for (const [key, column] of FLAGS) claim(rest, row, key, column, (v) => typeof v === "boolean");
  return row;
}

function toInsertRow(section, job, { position, source }) {
  const { id: _ignored, ...rest } = job;
  const fields = toRowFields(rest);
  return { ...fields, section, position, extra: rest, source };
}

/**
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} [options]
 */
export function createSupabaseData({ env = process.env, fetchImpl = fetch } = {}) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DATA_BACKEND=supabase");
  }

  async function request(path, { method = "GET", body } = {}) {
    const res = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
    return method === "GET" ? res.json() : undefined;
  }

  async function edgePosition(section, direction) {
    const rows = await request(`jobs?select=position&section=eq.${section}&order=position.${direction}&limit=1`);
    return rows.length ? rows[0].position : undefined;
  }

  return {
    /** Every job as `{ id, company, role, url, salary, notes, aiSummary }`, grouped by section. */
    async readBoard() {
      const board = Object.fromEntries(SECTIONS.map((s) => [s, []]));
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const select = "id,section,company,role,url,salary,notes,ai_summary";
        const rows = await request(`jobs?select=${select}&order=id&limit=${PAGE_SIZE}&offset=${offset}`);
        if (!rows.length) return board;
        for (const r of rows) {
          board[r.section]?.push({ id: r.id, company: r.company, role: r.role, url: r.url, salary: r.salary, notes: r.notes, aiSummary: r.ai_summary ?? undefined });
        }
      }
    },

    /**
     * Insert jobs into a section. placement "unshift" reproduces calling
     * array.unshift(job) for each one in turn (last job ends up first);
     * "push" appends in order. Matches how the JSON-backed scripts ordered them.
     */
    async addJobs(section, jobs, placement, { source = "scraper" } = {}) {
      if (!jobs.length) return;
      const edge = placement === "unshift" ? await edgePosition(section, "asc") : await edgePosition(section, "desc");
      const rows = placement === "unshift"
        ? [...jobs].reverse().map((job, i) => toInsertRow(section, job, { position: (edge ?? 0) - jobs.length + i, source }))
        : jobs.map((job, i) => toInsertRow(section, job, { position: (edge ?? -1) + 1 + i, source }));
      await request("jobs", { method: "POST", body: rows });
    },

    async setAiSummary(id, summary) {
      await request(`jobs?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: { ai_summary: summary } });
    },

    async readDocument(name) {
      const rows = await request(`documents?select=data&name=eq.${encodeURIComponent(name)}`);
      return rows.length ? rows[0].data : undefined;
    },
  };
}
