// The agent operations, once. The HTTP routes and the MCP tools both call these, so the
// rules (pending-only adds, four editable fields, no delete, duplicate check) cannot drift
// between the two doors. Each returns a status and a JSON body; callers decide how to send it.
import { AgentCreateJob, AgentEditJob, AgentListQuery, AgentMoveJob, JobId } from "@/lib/agent-job-schemas";
import { agentJobView } from "@/lib/agent-job-response";
import type { JobRepository } from "@/lib/job-repository";
import { normalizeForSection } from "@/lib/job-normalize";
import { SECTIONS } from "@/lib/jobs-mapping";
import { checkValue } from "@/lib/parse-body";

export interface OpResult {
  status: number;
  body: Record<string, unknown>;
}

type Job = Record<string, unknown>;
const ok = (body: Record<string, unknown>, status = 200): OpResult => ({ status, body });
const notFound = (): OpResult => ({ status: 404, body: { error: "Job not found" } });

export async function listJobsOp(repo: JobRepository, input: unknown): Promise<OpResult> {
  const query = checkValue(input, AgentListQuery);
  if (!("value" in query)) return query;
  const { section, limit, offset } = query.value;
  const board = await repo.readBoard();
  const all = (section ? [section] : SECTIONS).flatMap((name) =>
    (board[name] as unknown as Job[]).map((job) => ({ ...job, section: name })),
  );
  return ok({ jobs: all.slice(offset, offset + limit), total: all.length, limit, offset });
}

export async function getJobOp(repo: JobRepository, rawId: unknown): Promise<OpResult> {
  const id = JobId.safeParse(rawId);
  const found = id.success ? await repo.get({ id: id.data }) : undefined;
  return found ? ok({ job: agentJobView(found) }) : notFound();
}

/** Agents add to the inbox (pending) and nowhere else; a human triages from there. */
export async function addJobOp(repo: JobRepository, input: unknown): Promise<OpResult> {
  const body = checkValue(input, AgentCreateJob);
  if (!("value" in body)) return body;
  const { company, role, ...rest } = body.value;
  const candidate = { company: company.trim(), role: role.trim(), url: rest.url.trim() };
  // Includes archived jobs, so an agent cannot re-add something that was removed.
  const existing = await repo.findExisting(candidate);
  if (existing) return { status: 409, body: { error: "This job is already tracked", existing } };
  const job = normalizeForSection({ ...rest, ...candidate }, "pending");
  const id = await repo.add("pending", job);
  return ok({ job: agentJobView({ id: id ?? "", section: "pending", job }) }, 201);
}

/** Only notes, summary, score rationale and fit; the schema rejects every other field. */
export async function editJobOp(repo: JobRepository, rawId: unknown, input: unknown): Promise<OpResult> {
  const id = JobId.safeParse(rawId);
  if (!id.success) return notFound();
  const edit = checkValue(input, AgentEditJob);
  if (!("value" in edit)) return edit;
  const found = await repo.get({ id: id.data });
  if (!found) return notFound();
  const job = { ...found.job, ...edit.value };
  await repo.save({ id: id.data }, { section: found.section, job });
  return ok({ job: agentJobView({ ...found, job }) });
}

/** Triage: move a job between sections, including out of the inbox. */
export async function moveJobOp(repo: JobRepository, rawId: unknown, input: unknown): Promise<OpResult> {
  const id = JobId.safeParse(rawId);
  if (!id.success) return notFound();
  const move = checkValue(input, AgentMoveJob);
  if (!("value" in move)) return move;
  const found = await repo.get({ id: id.data });
  if (!found) return notFound();
  if (found.section === move.value.to) return { status: 400, body: { error: `The job is already in ${found.section}` } };
  const { isNew: _dropped, ...rest } = found.job;
  const job = normalizeForSection(rest, move.value.to);
  await repo.save({ id: id.data }, { section: move.value.to, job });
  return ok({ job: agentJobView({ id: found.id, section: move.value.to, job }) });
}

/**
 * Soft-delete: the job leaves the board but its row stays, and the event log records who did it.
 * There is deliberately no hard delete and no restore; restoring stays with the signed-in user.
 */
export async function archiveJobOp(repo: JobRepository, rawId: unknown): Promise<OpResult> {
  const id = JobId.safeParse(rawId);
  const archived = id.success && (await repo.archive({ id: id.data }));
  return archived ? ok({ ok: true }) : notFound();
}
