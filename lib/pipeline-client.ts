import type { MoveAction, PipelineCard } from "@/lib/pipeline";

type FetchFn = typeof fetch;
export type MoveResult = { ok: true } | { ok: false; message: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

async function send(fetchFn: FetchFn, method: "DELETE" | "PATCH", body: object): Promise<MoveResult> {
  const res = await fetchFn("/api/jobs", { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
  if (res.ok) return { ok: true };
  const detail = (await res.json().catch(() => ({}))) as { error?: unknown };
  return { ok: false, message: typeof detail.error === "string" ? detail.error : `Request failed (${res.status})` };
}

/** Runs a move chosen by `moveAction`: a section move first, then the status change if there is one. */
export async function applyMove(card: PipelineCard, action: MoveAction | null, fetchFn: FetchFn = fetch): Promise<MoveResult> {
  if (!action) return { ok: true };
  try {
    const ref = { id: card.id, company: card.company, role: card.role };
    if (action.section !== card.section) {
      const moved = await send(fetchFn, "DELETE", { ...ref, section: card.section, targetSection: action.section });
      if (!moved.ok || !action.status) return moved;
    }
    return action.status ? await send(fetchFn, "PATCH", { ...ref, section: action.section, updates: { status: action.status } }) : { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Move failed" };
  }
}
