/**
 * Import data/{jobs,config,profile,scrape-targets}.json into Supabase.
 *
 *   pnpm migrate:supabase                 dry run: read the source, print a report, write nothing
 *   pnpm migrate:supabase --apply         write to Supabase, then verify
 *   pnpm migrate:supabase --verify        compare Supabase with the source, write nothing
 *   --from-dir <dir>                      read <dir>/jobs.json etc. instead of the GitHub data repo
 *
 * The source is never modified. Re-running --apply is safe: jobs upsert on legacy_key.
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for --apply/--verify, and
 * GITHUB_TOKEN + GITHUB_DATA_REPO (+ GITHUB_DATA_BRANCH) unless --from-dir is used.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { githubRead } from "@/lib/github";
import type { JobsData } from "@/lib/jobs";
import { planImport, type ImportReport, type ImportRow } from "@/lib/jobs-import";
import { canonicalJson, rowsToJobsData, type JobRow } from "@/lib/jobs-mapping";
import { getSupabase } from "@/lib/supabase";
import { createJobRowStore } from "@/lib/supabase-row-store";

const DOCUMENT_NAMES = ["config", "profile", "scrape-targets"] as const;
type Documents = Partial<Record<(typeof DOCUMENT_NAMES)[number], unknown>>;
type Source = { jobs: JobsData; documents: Documents };
type Options = { apply: boolean; verify: boolean; fromDir?: string };

function parseArgs(argv: string[]): Options {
  const dirAt = argv.indexOf("--from-dir");
  return { apply: argv.includes("--apply"), verify: argv.includes("--verify"), fromDir: dirAt >= 0 ? argv[dirAt + 1] : undefined };
}

async function readSource(name: string, fromDir?: string): Promise<unknown | undefined> {
  try {
    const raw = fromDir ? await readFile(join(fromDir, `${name}.json`), "utf-8") : await githubRead(`data/${name}.json`);
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function loadSource(fromDir?: string): Promise<Source> {
  const jobs = ((await readSource("jobs", fromDir)) ?? {}) as JobsData;
  const documents: Documents = {};
  for (const name of DOCUMENT_NAMES) {
    const value = await readSource(name, fromDir);
    if (value !== undefined) documents[name] = value;
  }
  return { jobs, documents };
}

function printReport(report: ImportReport, documents: Documents): void {
  console.log("Jobs per section:", report.counts);
  console.log("Documents found:", Object.keys(documents).join(", ") || "none");
  const extra = Object.entries(report.extraKeys);
  console.log(extra.length ? "Fields kept in `extra` (no column):" : "No fields fell back to `extra`.", Object.fromEntries(extra));
  if (report.duplicates.length) console.log("Duplicate company+role within a section (all kept):", report.duplicates);
}

async function applyImport(rows: ImportRow[], documents: Documents): Promise<void> {
  const client = getSupabase();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client.from("jobs").upsert(rows.slice(i, i + 500), { onConflict: "legacy_key" });
    if (error) throw new Error(`jobs upsert failed: ${error.message}`);
  }
  for (const [name, data] of Object.entries(documents)) {
    const { error } = await client.from("documents").upsert({ name, data });
    if (error) throw new Error(`document "${name}" upsert failed: ${error.message}`);
  }
}

function withoutIds(data: JobsData): unknown {
  return Object.fromEntries(
    Object.entries(data).map(([section, jobs]) => [section, (jobs as { id?: string }[]).map(({ id: _id, ...job }) => job)]),
  );
}

async function verifyImport(rows: ImportRow[], documents: Documents): Promise<string[]> {
  const client = getSupabase();
  const stored = rowsToJobsData(await createJobRowStore(client).selectAll());
  const expected = rowsToJobsData(rows.map((row) => ({ ...row, id: "" }) as JobRow));
  const problems: string[] = [];
  if (canonicalJson(withoutIds(stored)) !== canonicalJson(withoutIds(expected))) problems.push("jobs in Supabase differ from the source");
  for (const [name, data] of Object.entries(documents)) {
    const { data: row } = await client.from("documents").select("data").eq("name", name).maybeSingle();
    if (!row || canonicalJson(row.data) !== canonicalJson(data)) problems.push(`document "${name}" differs from the source`);
  }
  return problems;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { jobs, documents } = await loadSource(options.fromDir);
  const { rows, report } = planImport(jobs);
  printReport(report, documents);

  if (!options.apply && !options.verify) return console.log("\nDry run only. Re-run with --apply to write.");
  if (options.apply) await applyImport(rows, documents);
  const problems = await verifyImport(rows, documents);
  if (problems.length) {
    problems.forEach((p) => console.error(`VERIFY FAILED: ${p}`));
    process.exit(1);
  }
  console.log(`\nVerified: Supabase matches the source (${rows.length} jobs).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
