import { readJobs, writeJobs, type JobSection } from "@/lib/jobs";
import { readProfile } from "@/lib/profile-server";
import { fetchJobDetails } from "@/lib/job-fetcher";

// ─── Anthropic tool definitions ───────────────────────────────────────────────

export const ANTHROPIC_TOOLS = [
  {
    name: "read_profile",
    description: "Read the candidate's full profile: name, title, summary, strengths, work history with bullets, education, and writing rules. Use this whenever assessing job fit, answering questions about the candidate's background, or comparing experience against a job description.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_jobs",
    description: "List jobs from the board. Optionally filter by section.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["applied", "prospect", "local", "staffing", "passed", "pending", "all"],
          description: "Section to list. Omit or use 'all' for every section.",
        },
      },
    },
  },
  {
    name: "add_job",
    description: "Add a new job to the board.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["applied", "prospect", "local", "staffing", "passed", "pending"] },
        company: { type: "string" },
        role: { type: "string" },
        url: { type: "string" },
        salary: { type: "string" },
        notes: { type: "string" },
        fit: {
          type: "string",
          enum: ["strong", "good", "caution", "weak"],
          description: "Required for prospect/local/staffing sections.",
        },
        status: {
          type: "string",
          enum: ["applied", "screening", "interview", "offer", "declined"],
          description: "Required for applied section.",
        },
        date: { type: "string", description: "YYYY-MM-DD, for applied section." },
      },
      required: ["section", "company", "role"],
    },
  },
  {
    name: "update_job",
    description: "Update one or more fields on an existing job.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["applied", "prospect", "local", "staffing", "passed", "pending"],
        },
        company: { type: "string" },
        role: { type: "string" },
        updates: {
          type: "object",
          description: "Key-value pairs of fields to update (status, notes, salary, fit, date, etc.)",
        },
      },
      required: ["section", "company", "role", "updates"],
    },
  },
  {
    name: "move_job",
    description: "Move a job from one section to another.",
    input_schema: {
      type: "object",
      properties: {
        from_section: {
          type: "string",
          enum: ["applied", "prospect", "local", "staffing", "passed", "pending"],
        },
        to_section: {
          type: "string",
          enum: ["applied", "prospect", "local", "staffing", "passed"],
        },
        company: { type: "string" },
        role: { type: "string" },
      },
      required: ["from_section", "to_section", "company", "role"],
    },
  },
  {
    name: "flag_ghost",
    description: "Flag an applied job as a ghost (no response/activity).",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string" },
        role: { type: "string" },
      },
      required: ["company", "role"],
    },
  },
  {
    name: "delete_job",
    description: "Permanently delete a job from the board.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["applied", "prospect", "local", "staffing", "passed", "pending"],
        },
        company: { type: "string" },
        role: { type: "string" },
      },
      required: ["section", "company", "role"],
    },
  },
  {
    name: "fetch_job_description",
    description:
      "Fetch job description text from a URL using direct fetch, Brave Search cross-post fallback, and Playwright when enabled. Returns retrieval metadata and a thin flag when automatic retrieval is limited.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Job posting URL" },
        company: {
          type: "string",
          description: "Company name — used to find homepage context if the JD page is blocked",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "detect_ghost_jobs",
    description:
      "Scan applied and prospect jobs for ghost job signals: stale applications with no response after 60+ days, status stuck at screening/interview for 30+ days, or the same company+role appearing in multiple sections (reposted listing). Returns a ranked list of flagged jobs with reasons.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_remote_jobs",
    description:
      "Search RemoteOK for remote job listings by keyword. Use as a fallback when a direct JD URL is blocked or gated. Returns up to 10 results with title, company, and link.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Space-separated keywords to search, e.g. 'design ux product'. Maps to RemoteOK tags.",
        },
      },
      required: ["keywords"],
    },
  },
];

// ─── OpenAI function format ───────────────────────────────────────────────────

export const OPENAI_TOOLS = ANTHROPIC_TOOLS.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

// ─── Tool execution ───────────────────────────────────────────────────────────

type AnyJob = Record<string, unknown>;

function normalizeForSection(job: AnyJob, section: JobSection): AnyJob {
  const out = { ...job };
  if (section === "applied") {
    if (!out.status) out.status = "applied";
    if (!out.date) out.date = new Date().toISOString().split("T")[0];
  } else if (section === "prospect" || section === "local" || section === "staffing") {
    if (!out.fit) out.fit = "good";
  } else if (section === "pending") {
    if (!out.scrapeGroup) out.scrapeGroup = "remote";
    if (!out.scrapeDate) out.scrapeDate = new Date().toISOString().split("T")[0];
  }
  return out;
}

function jobDetailHref(section: JobSection, company: unknown, role: unknown): string {
  const params = new URLSearchParams({
    section,
    company: String(company ?? ""),
    role: String(role ?? ""),
  });
  return `/job?${params.toString()}`;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    const jobs = await readJobs();

    switch (name) {
      case "read_profile": {
        const profile = await readProfile();
        return JSON.stringify(profile, null, 2);
      }

      case "list_jobs": {
        const section = input.section as string | undefined;
        if (!section || section === "all") return JSON.stringify(jobs, null, 2);
        return JSON.stringify((jobs[section as JobSection] ?? []), null, 2);
      }

      case "add_job": {
        const { section, ...rest } = input;
        const sec = section as JobSection;
        if (!jobs[sec]) return JSON.stringify({ error: `Unknown section: ${sec}` });
        const job = normalizeForSection(rest, sec);
        (jobs[sec] as unknown as AnyJob[]).unshift(job);
        await writeJobs(jobs);
        return JSON.stringify({ ok: true, added: job, detailUrl: jobDetailHref(sec, job.company, job.role) });
      }

      case "update_job": {
        const { section, company, role, updates } = input as {
          section: JobSection;
          company: string;
          role: string;
          updates: Record<string, unknown>;
        };
        const list = jobs[section] as unknown as AnyJob[];
        const idx = list.findIndex((j) => j.company === company && j.role === role);
        if (idx === -1) return JSON.stringify({ error: "Job not found" });
        list[idx] = { ...list[idx], ...updates };
        await writeJobs(jobs);
        return JSON.stringify({ ok: true, updated: list[idx] });
      }

      case "move_job": {
        const { from_section, to_section, company, role } = input as {
          from_section: JobSection;
          to_section: JobSection;
          company: string;
          role: string;
        };
        const fromList = jobs[from_section] as unknown as AnyJob[];
        const idx = fromList.findIndex((j) => j.company === company && j.role === role);
        if (idx === -1) return JSON.stringify({ error: "Job not found" });
        const [removed] = fromList.splice(idx, 1);
        delete removed.isNew;
        const normalized = normalizeForSection(removed, to_section);
        (jobs[to_section] as unknown as AnyJob[]).unshift(normalized);
        await writeJobs(jobs);
        return JSON.stringify({ ok: true });
      }

      case "flag_ghost": {
        const { company, role } = input as { company: string; role: string };
        const list = jobs.applied as unknown as AnyJob[];
        const idx = list.findIndex((j) => j.company === company && j.role === role);
        if (idx === -1) return JSON.stringify({ error: "Not found in applied section" });
        list[idx] = { ...list[idx], isGhost: true };
        await writeJobs(jobs);
        return JSON.stringify({ ok: true });
      }

      case "delete_job": {
        const { section, company, role } = input as {
          section: JobSection;
          company: string;
          role: string;
        };
        const list = jobs[section] as unknown as AnyJob[];
        const idx = list.findIndex((j) => j.company === company && j.role === role);
        if (idx === -1) return JSON.stringify({ error: "Job not found" });
        list.splice(idx, 1);
        await writeJobs(jobs);
        return JSON.stringify({ ok: true });
      }

      case "detect_ghost_jobs": {
        const today = new Date();
        type GhostFlag = { section: string; company: string; role: string; reason: string; daysSince?: number };
        const flags: GhostFlag[] = [];

        // Stale applied jobs
        for (const job of jobs.applied as unknown as AnyJob[]) {
          const dateStr = job.date as string | undefined;
          if (!dateStr) continue;
          const days = Math.floor((today.getTime() - new Date(dateStr).getTime()) / 86_400_000);
          const status = job.status as string | undefined;
          const company = job.company as string;
          const role = job.role as string;

          if (status === "applied" && days >= 90) {
            flags.push({ section: "applied", company, role, reason: `No response in ${days} days — likely ghost`, daysSince: days });
          } else if (status === "applied" && days >= 60) {
            flags.push({ section: "applied", company, role, reason: `No response in ${days} days — worth checking`, daysSince: days });
          } else if ((status === "screening" || status === "interview") && days >= 30) {
            flags.push({ section: "applied", company, role, reason: `Status stuck at "${status}" for ${days} days`, daysSince: days });
          }
        }

        // Duplicate company+role across sections (reposted)
        const allSections: JobSection[] = ["applied", "prospect", "local", "staffing"];
        const seen = new Map<string, string>();
        for (const sec of allSections) {
          for (const job of jobs[sec] as unknown as AnyJob[]) {
            const key = `${String(job.company).toLowerCase()}|${String(job.role).toLowerCase()}`;
            if (seen.has(key)) {
              const other = seen.get(key)!;
              const alreadyFlagged = flags.some(
                (f) => f.company === job.company && f.role === job.role && f.reason.startsWith("Duplicate")
              );
              if (!alreadyFlagged) {
                flags.push({
                  section: sec,
                  company: job.company as string,
                  role: job.role as string,
                  reason: `Duplicate: also in "${other}" — may be reposted`,
                });
              }
            } else {
              seen.set(key, sec);
            }
          }
        }

        flags.sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
        return JSON.stringify({ flagged: flags, total: flags.length });
      }

      case "fetch_job_description": {
        const { url, company } = input as { url: string; company?: string };
        const result = await fetchJobDetails({ url, company });
        return JSON.stringify({
          text: result.text.slice(0, 6000),
          thin: result.retrieval_limited,
          retrieval_limited: result.retrieval_limited,
          retrieval_method: result.retrieval_method,
          source_url: result.source_url,
          warning: result.warning,
        });
      }

      case "search_remote_jobs": {
        const { keywords } = input as { keywords: string };
        const tags = keywords.trim().toLowerCase().replace(/\s+/g, ",");
        const url = `https://remoteok.com/api?tag=${encodeURIComponent(tags)}&limit=10`;
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; deckhandAI/1.0)" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return JSON.stringify({ error: `RemoteOK returned ${res.status}` });
          const json = await res.json() as unknown[];
          // First element is metadata, rest are jobs
          const jobs = json.slice(1).filter((j): j is Record<string, unknown> => typeof j === "object" && j !== null);
          const results = jobs.slice(0, 10).map((j) => ({
            title: j.position ?? "",
            company: j.company ?? "",
            url: j.url ?? "",
            tags: Array.isArray(j.tags) ? (j.tags as string[]).slice(0, 5).join(", ") : "",
          }));
          return JSON.stringify(results);
        } catch (err) {
          return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}
