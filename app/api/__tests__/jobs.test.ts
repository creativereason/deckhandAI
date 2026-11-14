import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH, POST } from "@/app/api/jobs/route";
import { addJob, archiveJob, getJob, saveJob } from "@/lib/jobs-repository";
import { generateAiSummary } from "@/lib/job-summary-server";

vi.mock("@/lib/jobs-repository", () => ({
  readJobs: vi.fn(),
  addJob: vi.fn(),
  getJob: vi.fn(),
  saveJob: vi.fn(),
  archiveJob: vi.fn(),
}));

vi.mock("@/lib/job-summary-server", () => ({
  generateAiSummary: vi.fn(),
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function deleteRequest(body: unknown) {
  return new NextRequest("http://localhost/api/jobs", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/jobs", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const prospectJob = { company: "Acme", role: "Designer", fit: "good", salary: "", notes: "", url: "" };

beforeEach(() => {
  [addJob, getJob, saveJob, archiveJob].forEach((fn) => vi.mocked(fn).mockReset());
  vi.mocked(getJob).mockResolvedValue({ id: "job-1", section: "prospect", job: { ...prospectJob } });
  vi.mocked(saveJob).mockResolvedValue(true);
  vi.mocked(archiveJob).mockResolvedValue(true);
  vi.mocked(generateAiSummary).mockReset();
});

describe("POST /api/jobs", () => {
  it("fills aiSummary from the generator when the new job has none", async () => {
    vi.mocked(generateAiSummary).mockResolvedValue("Acme builds robots. The role owns UX.");

    const response = await POST(request({
      section: "prospect",
      job: { company: "Acme", role: "Designer", fit: "good", salary: "", notes: "Team of five.", url: "" },
    }));

    expect(response.status).toBe(200);
    expect(generateAiSummary).toHaveBeenCalledWith(expect.objectContaining({ company: "Acme", role: "Designer" }));
    expect(addJob).toHaveBeenCalledWith("prospect", expect.objectContaining({ aiSummary: "Acme builds robots. The role owns UX." }));
  });

  it("keeps a caller-provided aiSummary without calling the generator", async () => {
    const response = await POST(request({
      section: "prospect",
      job: { company: "Acme", role: "Designer", fit: "good", aiSummary: "Provided summary." },
    }));

    expect(response.status).toBe(200);
    expect(generateAiSummary).not.toHaveBeenCalled();
    expect(addJob).toHaveBeenCalledWith("prospect", expect.objectContaining({ aiSummary: "Provided summary." }));
  });
});

describe("DELETE /api/jobs (move to applied)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps today's date when a job with no date moves into applied", async () => {
    const response = await DELETE(deleteRequest({
      section: "prospect",
      company: "Acme",
      role: "Designer",
      targetSection: "applied",
    }));

    expect(response.status).toBe(200);
    expect(saveJob).toHaveBeenCalledWith(
      expect.objectContaining({ section: "prospect", company: "Acme", role: "Designer" }),
      { section: "applied", job: expect.objectContaining({ date: "2026-07-16" }) },
    );
  });

  it("clears the new badge when a job is moved", async () => {
    vi.mocked(getJob).mockResolvedValue({ id: "job-1", section: "prospect", job: { ...prospectJob, isNew: true } });

    await DELETE(deleteRequest({ section: "prospect", company: "Acme", role: "Designer", targetSection: "passed" }));

    expect(vi.mocked(saveJob).mock.calls[0][1].job).not.toHaveProperty("isNew");
  });
});

describe("DELETE /api/jobs (remove)", () => {
  it("archives the job instead of saving it elsewhere when there is no target section", async () => {
    const response = await DELETE(deleteRequest({ id: "job-1", section: "prospect", company: "Acme", role: "Designer" }));

    expect(response.status).toBe(200);
    expect(archiveJob).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }));
    expect(saveJob).not.toHaveBeenCalled();
  });

  it("returns 404 and changes nothing for an unknown job", async () => {
    vi.mocked(getJob).mockResolvedValue(undefined);

    const response = await DELETE(deleteRequest({ section: "prospect", company: "Nope", role: "Nope" }));

    expect(response.status).toBe(404);
    expect(archiveJob).not.toHaveBeenCalled();
    expect(saveJob).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/jobs", () => {
  it("merges the updates into the stored job and saves it in the same section", async () => {
    const response = await PATCH(patchRequest({ id: "job-1", section: "prospect", company: "Acme", role: "Designer", updates: { notes: "edited" } }));

    expect(response.status).toBe(200);
    expect(saveJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-1" }),
      { section: "prospect", job: expect.objectContaining({ role: "Designer", notes: "edited" }) },
    );
  });

  it("moves the job when a target section is given", async () => {
    await PATCH(patchRequest({ section: "prospect", company: "Acme", role: "Designer", updates: {}, targetSection: "passed" }));

    expect(saveJob).toHaveBeenCalledWith(expect.anything(), { section: "passed", job: expect.anything() });
  });

  it("returns 404 and writes nothing for an unknown job", async () => {
    vi.mocked(getJob).mockResolvedValue(undefined);

    const response = await PATCH(patchRequest({ section: "prospect", company: "Nope", role: "Nope", updates: {} }));

    expect(response.status).toBe(404);
    expect(saveJob).not.toHaveBeenCalled();
  });
});

describe("request validation", () => {
  const raw = (method: string, body: string) =>
    new NextRequest("http://localhost/api/jobs", { method, body, headers: { "Content-Type": "application/json" } });
  const nothingWritten = () => {
    expect(addJob).not.toHaveBeenCalled();
    expect(saveJob).not.toHaveBeenCalled();
    expect(archiveJob).not.toHaveBeenCalled();
  };

  // Z — Zero
  it.each([["POST", POST], ["PATCH", PATCH], ["DELETE", DELETE]] as const)("%s returns 400, not 500, for an empty or malformed body", async (method, handler) => {
    expect((await handler(raw(method, "{}"))).status).toBe(400);
    expect((await handler(raw(method, "not json"))).status).toBe(400);
    nothingWritten();
  });

  // E — Exception: the error names the field to fix
  it("POST names the invalid field and does not call the AI summary generator", async () => {
    const response = await POST(request({ section: "prospect", job: { company: "Acme", role: "Designer", fit: "great" } }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues).toEqual([expect.objectContaining({ path: "job.fit" })]);
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain("job.fit");
    expect(generateAiSummary).not.toHaveBeenCalled();
    nothingWritten();
  });

  it("POST rejects an unknown section instead of crashing", async () => {
    expect((await POST(request({ section: "nowhere", job: prospectJob }))).status).toBe(400);
    nothingWritten();
  });

  it("PATCH rejects invalid updates before looking the job up", async () => {
    const response = await PATCH(patchRequest({ section: "prospect", company: "Acme", role: "Designer", updates: { status: "nope" } }));

    expect(response.status).toBe(400);
    expect(getJob).not.toHaveBeenCalled();
    nothingWritten();
  });

  it("DELETE rejects a body that does not name a job", async () => {
    expect((await DELETE(deleteRequest({ section: "prospect" }))).status).toBe(400);
    nothingWritten();
  });

  // B — Boundary: valid bodies are unaffected, including fields the schema does not list
  it("still accepts a job with extra fields", async () => {
    const response = await POST(request({ section: "prospect", job: { ...prospectJob, aiSummary: "s", custom: "kept" } }));

    expect(response.status).toBe(200);
    expect(addJob).toHaveBeenCalledWith("prospect", expect.objectContaining({ custom: "kept" }));
  });
});
