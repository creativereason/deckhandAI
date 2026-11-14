import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import JobFormModal from "@/components/JobFormModal";
import type { ProspectJob } from "@/lib/jobs";

const job: ProspectJob = { company: "Acme", role: "Designer", fit: "good", salary: "", notes: "", url: "" };

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function saveEdit(editing: ProspectJob) {
  const fetchMock = stubFetch();
  render(<JobFormModal mode="edit" section="prospect" job={editing} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
  const patch = () => fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
  await waitFor(() => expect(patch()).toBeDefined());
  return JSON.parse(patch()![1].body as string) as Record<string, unknown>;
}

afterEach(() => vi.unstubAllGlobals());

describe("JobFormModal save", () => {
  // O — One: two jobs can share a company and role, so the stored id must identify which one is edited
  it("sends the job id when editing a job that has one", async () => {
    expect(await saveEdit({ ...job, id: "job-1" })).toMatchObject({ id: "job-1", company: "Acme", role: "Designer" });
  });

  // B — Boundary: JSON-backed jobs have no id and still match on company + role
  it("sends no id when the job has none", async () => {
    expect((await saveEdit(job)).id).toBeUndefined();
  });
});
