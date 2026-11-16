import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChatDrawer from "@/components/ChatDrawer";

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

function submit(text: string) {
  const input = screen.getByPlaceholderText("Message…");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByText("Send"));
}

describe("ChatDrawer evaluation without detected company/role", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("disables Add to pending and shows a manual-add message when company and role are both empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: sseStream([
        { event: "status", data: "Fetching page..." },
        {
          event: "result",
          data: {
            company: "",
            role: "",
            url: "https://example.com/job",
            salary: "",
            notes: "Scraped notes",
            fit: "good",
            scoreRationale: "Configure AI to score fit automatically.",
            retrieval: { retrieval_method: "fetch_only", retrieval_limited: false },
          },
        },
      ]),
    }));

    render(<ChatDrawer onJobsChanged={vi.fn()} />);
    submit("Evaluate this job URL: https://example.com/job");

    await waitFor(() => {
      expect(screen.getByText(/Couldn't detect company\/role automatically/)).toBeInTheDocument();
    });
    expect(screen.getByText("Add to pending")).toBeDisabled();
  });

  it("keeps Add to pending enabled when company and role are both detected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: sseStream([
        {
          event: "result",
          data: {
            company: "Acme",
            role: "Senior UX Designer",
            url: "https://example.com/job",
            salary: "",
            notes: "Scraped notes",
            fit: "good",
            scoreRationale: "Strong fit.",
            retrieval: { retrieval_method: "fetch_only", retrieval_limited: false },
          },
        },
      ]),
    }));

    render(<ChatDrawer onJobsChanged={vi.fn()} />);
    submit("Evaluate this job URL: https://example.com/job");

    await waitFor(() => {
      expect(screen.getByText("Add to pending")).toBeEnabled();
    });
  });
});

describe("ChatDrawer as the shared assistant panel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  // O — One: the simplest render shows the composer and the starter prompts
  it("renders the composer and starter prompts", () => {
    render(<ChatDrawer onJobsChanged={vi.fn()} />);

    expect(screen.getByPlaceholderText("Message…")).toBeInTheDocument();
    expect(screen.getByText("Scan for ghost jobs")).toBeInTheDocument();
  });

  // I — Interface: closing is the host's decision, so the panel only offers it when asked
  it("offers Close only when the host passes onClose, and calls it", () => {
    const onClose = vi.fn();
    const { rerender } = render(<ChatDrawer onJobsChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    rerender(<ChatDrawer onJobsChanged={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  // I — Interface: another screen can hand the assistant a prompt
  it("puts a request from another screen in the composer when it should not auto-send", () => {
    render(<ChatDrawer onJobsChanged={vi.fn()} request={{ id: 1, text: "Draft a follow-up", send: false }} />);

    expect(screen.getByPlaceholderText("Message…")).toHaveValue("Draft a follow-up");
  });

  it("sends a request from another screen straight away when asked to", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: new ReadableStream({ start(c) { c.close(); } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatDrawer onJobsChanged={vi.fn()} request={{ id: 7, text: "What are the red flags?", send: true }} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" })));
    expect(screen.getByText("What are the red flags?")).toBeInTheDocument();
  });
});
