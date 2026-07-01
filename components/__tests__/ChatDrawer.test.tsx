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

function openDrawerAndSubmit(text: string) {
  fireEvent.click(screen.getByLabelText("Open assistant"));
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
    openDrawerAndSubmit("Evaluate this job URL: https://example.com/job");

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
    openDrawerAndSubmit("Evaluate this job URL: https://example.com/job");

    await waitFor(() => {
      expect(screen.getByText("Add to pending")).toBeEnabled();
    });
  });
});
