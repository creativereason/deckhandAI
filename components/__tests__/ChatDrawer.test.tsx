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

describe("ChatDrawer collapse/expand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
  });

  // O — One: the simplest render shows the chat body without any interaction.
  it("renders expanded by default", () => {
    render(<ChatDrawer onJobsChanged={vi.fn()} />);

    expect(screen.getByPlaceholderText("Message…")).toBeInTheDocument();
    expect(screen.getByLabelText("Collapse assistant")).toBeInTheDocument();
  });

  // B — Boundary: toggling collapse hides and restores the chat body.
  it("hides the message input when collapsed, and restores it when expanded again", () => {
    render(<ChatDrawer onJobsChanged={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Collapse assistant"));
    expect(screen.queryByPlaceholderText("Message…")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Expand assistant"));
    expect(screen.getByPlaceholderText("Message…")).toBeInTheDocument();
  });

  // E — Exception: collapsed state survives a remount instead of always resetting to expanded.
  it("persists the collapsed state across remounts", () => {
    const { unmount } = render(<ChatDrawer onJobsChanged={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Collapse assistant"));
    unmount();

    render(<ChatDrawer onJobsChanged={vi.fn()} />);

    expect(screen.queryByPlaceholderText("Message…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expand assistant")).toBeInTheDocument();
  });
});
