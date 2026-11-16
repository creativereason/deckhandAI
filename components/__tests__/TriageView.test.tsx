import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TriageView from "@/components/TriageView";
import { submitReview } from "@/lib/review-client";
import type { PendingJob } from "@/lib/jobs";

vi.mock("@/lib/review-client", () => ({ submitReview: vi.fn() }));
vi.mock("@/components/use-score-pending", () => ({ useScorePending: () => false }));

const job = (company: string, extra: Partial<PendingJob> = {}): PendingJob => ({
  id: `id-${company}`, company, role: `${company} Role`, url: "https://example.com/1", salary: "$100k",
  notes: "Posting text", scrapeGroup: "remote", scrapeDate: "2026-01-01", fit: "strong",
  scoreRationale: "Matches your titles", aiSummary: `${company} summary`, ...extra,
});
const three = [job("Alpha"), job("Bravo"), job("Charlie")];
const renderView = (pending = three, onUpdate = vi.fn()) =>
  render(<TriageView pending={pending} onUpdate={onUpdate} onBackToBoard={() => {}} />);

beforeEach(() => {
  vi.mocked(submitReview).mockReset();
  vi.mocked(submitReview).mockResolvedValue({ ok: true });
});

describe("TriageView", () => {
  // Z — Zero
  it("says the inbox is cleared when there is nothing left to review", () => {
    renderView([]);

    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add to prospects/i })).not.toBeInTheDocument();
  });

  // O — One
  it("shows the first job in full with its summary, fit, rationale and salary", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "Alpha Role" })).toBeInTheDocument();
    expect(screen.getByText("Alpha summary")).toBeInTheDocument();
    expect(screen.getByText("Matches your titles")).toBeInTheDocument();
    expect(screen.getByText("$100k")).toBeInTheDocument();
    expect(screen.getByText(/strong fit/i)).toBeInTheDocument();
    expect(screen.getByText("Reviewed 0 of 3")).toBeInTheDocument();
  });

  // M — Many
  it("lists the jobs coming up next", () => {
    renderView();

    const next = screen.getByRole("list", { name: /up next/i });
    expect(next).toHaveTextContent("Bravo");
    expect(next).toHaveTextContent("Charlie");
    expect(next).not.toHaveTextContent("Alpha");
  });

  // B — Boundary: skipping loses nothing
  it("skips to the next job and brings the skipped one back round", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /^skip/i }));
    expect(screen.getByRole("heading", { name: "Bravo Role" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "Alpha Role" })).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });

  // I — Interface: add and pass, by button and by key
  it("keeps the current job with its fit and rationale, then shows the next one", async () => {
    const onUpdate = vi.fn();
    renderView(three, onUpdate);

    fireEvent.keyDown(window, { key: "a" });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Bravo Role" })).toBeInTheDocument());
    expect(submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ action: "approve", fit: "strong", scoreRationale: "Matches your titles", job: expect.objectContaining({ id: "id-Alpha" }) }),
    );
    expect(screen.getByText("Reviewed 1 of 3")).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("passes on the current job when Pass is clicked", async () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /^pass/i }));

    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(expect.objectContaining({ action: "reject" })));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Bravo Role" })).toBeInTheDocument());
  });

  // E — Exception: a failed save keeps the job in front of the user
  it("keeps the job on screen when saving fails", async () => {
    vi.mocked(submitReview).mockResolvedValue({ ok: false, demo: false, message: "boom" });
    renderView();

    fireEvent.keyDown(window, { key: "p" });

    await waitFor(() => expect(submitReview).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Alpha Role" })).toBeInTheDocument();
    expect(screen.getByText("Reviewed 0 of 3")).toBeInTheDocument();
  });

  it("ignores a second shortcut while the first is still saving", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    vi.mocked(submitReview).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderView();

    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "p" });
    finish({ ok: true });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Bravo Role" })).toBeInTheDocument());
    expect(submitReview).toHaveBeenCalledTimes(1);
  });

  // S — Simple: working through the whole inbox
  it("ends on the all-caught-up message after the last job", async () => {
    renderView([job("Solo")]);

    fireEvent.keyDown(window, { key: "a" });

    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());
  });

  it("shows when a job is still being scored instead of an empty rationale", () => {
    renderView([job("Fresh", { scoreRationale: undefined, fit: undefined })]);

    expect(screen.getByText(/not scored yet/i)).toBeInTheDocument();
  });

  // I — Interface: pressing a shortcut visibly acknowledges it right away
  describe("when an action key is pressed", () => {
    afterEach(() => vi.useRealTimers());

    it("marks the matching button as pressed straight away, before the save returns", () => {
      vi.mocked(submitReview).mockReturnValue(new Promise(() => {}));
      renderView();

      fireEvent.keyDown(window, { key: "a" });

      expect(screen.getByRole("button", { name: /^add to prospects/i })).toHaveAttribute("data-pressed", "true");
      expect(screen.getByRole("button", { name: /^pass/i })).not.toHaveAttribute("data-pressed");
    });

    it("marks the skip button too, since skipping saves nothing to toast about", () => {
      renderView();

      fireEvent.keyDown(window, { key: "s" });

      expect(screen.getByRole("button", { name: /^skip/i })).toHaveAttribute("data-pressed", "true");
    });

    it("clears the pressed mark after a moment", () => {
      vi.useFakeTimers();
      renderView();

      fireEvent.keyDown(window, { key: "p" });
      expect(screen.getByRole("button", { name: /^pass/i })).toHaveAttribute("data-pressed", "true");
      act(() => { vi.advanceTimersByTime(400); });

      expect(screen.getByRole("button", { name: /^pass/i })).not.toHaveAttribute("data-pressed");
    });
  });

  // I — Interface: opening from the list lands on that job, with the rest still reachable
  it("opens on the job it is told to start at, not the first in the queue", () => {
    render(<TriageView pending={three} onUpdate={vi.fn()} onBackToBoard={() => {}} startAt={three[1]} />);

    expect(screen.getByRole("heading", { name: "Bravo Role" })).toBeInTheDocument();
    expect(screen.getByText("Reviewed 0 of 3")).toBeInTheDocument();
  });

  it("falls back to the first job when the start job is no longer in the queue", () => {
    render(<TriageView pending={three} onUpdate={vi.fn()} onBackToBoard={() => {}} startAt={{ ...three[0], company: "Gone", role: "Gone Role", id: undefined }} />);

    expect(screen.getByRole("heading", { name: "Alpha Role" })).toBeInTheDocument();
  });
});
