import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import JobPage from "@/app/job/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ company: "Acme", role: "Designer", section: "prospect" }),
}));

function sseStream(events: Array<{ event: string; data: unknown }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const body = events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
}

const JOBS_DATA = {
  applied: [],
  prospect: [{
    company: "Acme",
    role: "Designer",
    fit: "good",
    salary: "",
    notes: "Original notes I wrote by hand.",
    url: "https://example.com/job",
  }],
  local: [],
  staffing: [],
  passed: [],
  pending: [],
};

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/jobs" && method === "GET") {
      return new Response(JSON.stringify(JOBS_DATA), { status: 200 });
    }
    if (url === "/api/profile" && method === "GET") {
      return new Response(JSON.stringify({ name: "Brian" }), { status: 200 });
    }
    if (url === "/api/evaluate-job" && method === "POST") {
      return {
        ok: true,
        body: sseStream([
          {
            event: "result",
            data: {
              company: "Acme",
              role: "Designer",
              salary: "",
              notes: "Scraped 2026-07-01.\n\nCompany: Acme builds things.\n\nRole: Designer role summary.",
              fit: "good",
              scoreRationale: "Configure AI to score fit automatically.",
              retrieval: { retrieval_limited: false },
            },
          },
        ]),
      } as unknown as Response;
    }
    if (url === "/api/jobs" && method === "PATCH") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
}

describe("JobChat notes refresh confirmation", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows an Apply/Cancel preview instead of auto-saving refreshed notes", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<JobPage />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Ask about this role…");
    fireEvent.change(input, { target: { value: "refresh the notes from the url" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText(/Designer role summary/)).toBeInTheDocument();
    });
    expect(screen.getByText("Apply")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/jobs", expect.objectContaining({ method: "PATCH" }));
  });

  it("only PATCHes the job after the user clicks Apply", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<JobPage />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Ask about this role…"), { target: { value: "refresh the notes from the url" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText("Apply")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/jobs", expect.objectContaining({ method: "PATCH" }));
    });
  });

  it("discards the proposal and does not PATCH when the user clicks Cancel", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<JobPage />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Ask about this role…"), { target: { value: "refresh the notes from the url" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText("Cancel")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => expect(screen.queryByText("Apply")).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalledWith("/api/jobs", expect.objectContaining({ method: "PATCH" }));
  });
});
