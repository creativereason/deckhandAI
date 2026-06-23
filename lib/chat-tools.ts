import { readJobs, writeJobs, type JobSection } from "@/lib/jobs";
import { fetchJdText } from "@/lib/fetch-jd";

// ─── Anthropic tool definitions ───────────────────────────────────────────────

export const ANTHROPIC_TOOLS = [
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
        section: { type: "string", enum: ["applied", "prospect", "local", "staffing", "passed"] },
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
      "Fetch the job description text from a URL. Returns the text and a 'thin' flag if the page was gated or blocked. If thin is true, try search_indeed as a fallback.",
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
    name: "search_indeed",
    description:
      "Search Indeed for job listings matching a query. Use as fallback when a direct JD URL is blocked. Returns up to 10 results with title, company, link, and snippet.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g. 'Head of Design Stripe'" },
        location: { type: "string", description: "Location filter, e.g. 'remote' or 'New York, NY'. Defaults to remote." },
      },
      required: ["query"],
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
  }
  return out;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    const jobs = await readJobs();

    switch (name) {
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
        return JSON.stringify({ ok: true, added: job });
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

      case "fetch_job_description": {
        const { url, company } = input as { url: string; company?: string };
        const text = await fetchJdText(url, company);
        const thin = text.length < 300;
        return JSON.stringify({ text: text.slice(0, 6000), thin });
      }

      case "search_indeed": {
        const { query, location = "remote" } = input as { query: string; location?: string };
        const feedUrl = `https://www.indeed.com/rss?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&limit=10`;
        try {
          const res = await fetch(feedUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; deckhandAI/1.0)" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return JSON.stringify({ error: `Indeed returned ${res.status}` });
          const xml = await res.text();
          const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
            const block = m[1];
            const title =
              block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
              block.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
            const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
            const snippet = (
              block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? ""
            )
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 250);
            return { title, link, snippet };
          });
          return JSON.stringify(items.slice(0, 10));
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
