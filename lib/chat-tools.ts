import type { JobSection, JobsData } from "@/lib/jobs";
import { jobDetailHref } from "@/lib/job-detail";
import { normalizeForSection } from "@/lib/job-normalize";
import { addJob, archiveJob, getJob, readJobs, saveJob, updateJobs } from "@/lib/jobs-repository";
import { readProfile } from "@/lib/profile-server";
import { fetchJobDetails } from "@/lib/job-fetcher";
import { generateAiSummary } from "@/lib/job-summary-server";

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
        aiSummary: {
          type: "string",
          description:
            "1–2 sentence at-a-glance summary of what the role is and what the company does. Provide it when you have job description context; it is generated automatically otherwise.",
        },
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
          description: "Key-value pairs of fields to update. Updatable fields: status, notes, salary, fit, scoreRationale, aiSummary, date, url. When updating fit always include scoreRationale explaining why. aiSummary is a 1–2 sentence at-a-glance summary of the role and company.",
        },
      },
      required: ["section", "company", "role", "updates"],
    },
  },
  {
    name: "update_jobs",
    description: "Apply the same field updates to several jobs in one section in a single step. Use this instead of calling update_job repeatedly whenever more than one job needs the same change, for example marking many applied jobs declined. Returns how many were updated and which were not found.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["applied", "prospect", "local", "staffing", "passed", "pending"],
        },
        jobs: {
          type: "array",
          description: "The jobs to update, each identified by company and role exactly as returned by list_jobs.",
          items: {
            type: "object",
            properties: { company: { type: "string" }, role: { type: "string" } },
            required: ["company", "role"],
          },
        },
        updates: {
          type: "object",
          description: "Key-value pairs applied to every listed job. Same updatable fields as update_job.",
        },
      },
      required: ["section", "jobs", "updates"],
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
    description: "Remove a job from the board. The job is archived, not erased, so it can be recovered later. Only do this when the user explicitly asks to remove it.",
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

function detailHrefFor(section: JobSection, job: AnyJob): string {
  return jobDetailHref({
    section,
    company: String(job.company ?? ""),
    role: String(job.role ?? ""),
    id: typeof job.id === "string" ? job.id : undefined,
  });
}

const SECTION_NAMES: JobSection[] = ["applied", "prospect", "local", "staffing", "passed", "pending"];

interface JobArgs {
  section: JobSection;
  company: string;
  role: string;
}

async function addJobTool(input: Record<string, unknown>): Promise<string> {
  const { section, ...rest } = input;
  const sec = section as JobSection;
  if (!SECTION_NAMES.includes(sec)) return JSON.stringify({ error: `Unknown section: ${sec}` });
  const job = normalizeForSection(rest, sec);
  if (!job.aiSummary) {
    job.aiSummary = await generateAiSummary({
      company: String(job.company ?? ""),
      role: String(job.role ?? ""),
      salary: typeof job.salary === "string" ? job.salary : undefined,
      notes: typeof job.notes === "string" ? job.notes : undefined,
    });
  }
  const id = await addJob(sec, job);
  return JSON.stringify({ ok: true, added: job, detailUrl: detailHrefFor(sec, { ...job, id }) });
}

async function updateJobTool(input: Record<string, unknown>): Promise<string> {
  const { updates, ...ref } = input as unknown as JobArgs & { updates: Record<string, unknown> };
  const found = await getJob(ref);
  if (!found) return JSON.stringify({ error: "Job not found" });
  const updated = { ...found.job, ...updates };
  await saveJob(ref, { section: found.section, job: updated });
  return JSON.stringify({ ok: true, updated });
}

async function updateJobsTool(input: Record<string, unknown>): Promise<string> {
  const { section, jobs: targets, updates } = input as {
    section: JobSection;
    jobs: { company: string; role: string }[];
    updates: Record<string, unknown>;
  };
  const refs = targets.map(({ company, role }) => ({ section, company, role }));
  const { updated, notFound } = await updateJobs({ targets: refs, updates });
  return JSON.stringify({ ok: true, updated, notFound: notFound.map(({ company, role }) => ({ company, role })) });
}

async function moveJobTool(input: Record<string, unknown>): Promise<string> {
  const { from_section, to_section, company, role } = input as {
    from_section: JobSection;
    to_section: JobSection;
    company: string;
    role: string;
  };
  const ref = { section: from_section, company, role };
  const found = await getJob(ref);
  if (!found) return JSON.stringify({ error: "Job not found" });
  const { isNew: _dropped, ...job } = found.job;
  await saveJob(ref, { section: to_section, job: normalizeForSection(job, to_section) });
  return JSON.stringify({ ok: true });
}

async function flagGhostTool(input: Record<string, unknown>): Promise<string> {
  const ref = { section: "applied" as const, company: String(input.company), role: String(input.role) };
  const found = await getJob(ref);
  if (!found) return JSON.stringify({ error: "Not found in applied section" });
  await saveJob(ref, { section: "applied", job: { ...found.job, isGhost: true } });
  return JSON.stringify({ ok: true });
}

async function deleteJobTool(input: Record<string, unknown>): Promise<string> {
  const archived = await archiveJob(input as unknown as JobArgs);
  return JSON.stringify(archived ? { ok: true } : { error: "Job not found" });
}

function listJobsTool(jobs: JobsData, section: string | undefined): string {
  const withDetailUrl = (sec: JobSection, list: AnyJob[]) =>
    list.map((job) => ({ ...job, detailUrl: detailHrefFor(sec, job) }));

  if (!section || section === "all") {
    const withUrls = Object.fromEntries(
      (Object.keys(jobs) as JobSection[]).map((sec) => [sec, withDetailUrl(sec, jobs[sec] as unknown as AnyJob[])])
    );
    return JSON.stringify(withUrls, null, 2);
  }
  return JSON.stringify(withDetailUrl(section as JobSection, (jobs[section as JobSection] ?? []) as unknown as AnyJob[]), null, 2);
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "read_profile":
        return JSON.stringify(await readProfile(), null, 2);
      case "list_jobs":
        return listJobsTool(await readJobs(), input.section as string | undefined);
      case "add_job":
        return await addJobTool(input);
      case "update_job":
        return await updateJobTool(input);
      case "update_jobs":
        return await updateJobsTool(input);
      case "move_job":
        return await moveJobTool(input);
      case "flag_ghost":
        return await flagGhostTool(input);
      case "delete_job":
        return await deleteJobTool(input);

      case "detect_ghost_jobs": {
        const jobs = await readJobs();
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
