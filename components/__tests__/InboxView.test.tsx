import { describe, expect, it, vi } from "vitest";
import { beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InboxView from "@/components/InboxView";
import type { PendingJob } from "@/lib/jobs";

vi.mock("@/components/ScrapeReviewQueue", () => ({
  default: ({ pending, onOpen }: { pending: PendingJob[]; onOpen?: (job: PendingJob) => void }) => (
    <div data-testid="queue">{pending.length} in queue<button onClick={() => onOpen?.(pending[1])}>open second</button></div>
  ),
}));

vi.mock("@/components/TriageView", () => ({
  default: ({ pending, startAt }: { pending: PendingJob[]; startAt?: PendingJob }) => (
    <div data-testid="triage">{pending.length} to triage{startAt ? ` starting at ${startAt.role}` : ""}</div>
  ),
}));

beforeEach(() => localStorage.clear());

const job = (role: string): PendingJob => ({
  company: "Acme", role, url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-01-01",
});

describe("InboxView", () => {
  // Z — Zero
  it("tells the user the inbox is empty instead of rendering an empty queue", () => {
    render(<InboxView pending={[]} onUpdate={() => {}} onBackToBoard={() => {}} />);

    expect(screen.getByText(/inbox is empty/i)).toBeInTheDocument();
    expect(screen.queryByTestId("queue")).not.toBeInTheDocument();
  });

  // O — One: the triage view is the default
  it("opens in triage mode by default", () => {
    render(<InboxView pending={[job("A")]} onUpdate={() => {}} onBackToBoard={() => {}} />);

    expect(screen.getByTestId("triage")).toHaveTextContent("1 to triage");
    expect(screen.queryByTestId("queue")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Triage" })).toBeChecked();
  });

  // M — Many
  it("renders every pending job in the review queue when the list is chosen", () => {
    render(<InboxView pending={[job("A"), job("B"), job("C")]} onUpdate={() => {}} onBackToBoard={() => {}} />);

    fireEvent.click(screen.getByRole("radio", { name: "List" }));

    expect(screen.getByTestId("queue")).toHaveTextContent("3 in queue");
    expect(screen.queryByTestId("triage")).not.toBeInTheDocument();
  });

  // B — Boundary: the choice is remembered, and a bad saved value is ignored
  it("remembers the chosen mode for next time", () => {
    const { unmount } = render(<InboxView pending={[job("A")]} onUpdate={() => {}} onBackToBoard={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    unmount();

    render(<InboxView pending={[job("A")]} onUpdate={() => {}} onBackToBoard={() => {}} />);

    expect(screen.getByTestId("queue")).toBeInTheDocument();
  });

  it("falls back to triage when the saved mode is not one it knows", () => {
    localStorage.setItem("inbox-mode", "banana");

    render(<InboxView pending={[job("A")]} onUpdate={() => {}} onBackToBoard={() => {}} />);

    expect(screen.getByTestId("triage")).toBeInTheDocument();
  });

  // S — Simple: the empty state offers a way out
  it("offers a way back to the board from the empty state", () => {
    const onBackToBoard = vi.fn();
    render(<InboxView pending={[]} onUpdate={() => {}} onBackToBoard={onBackToBoard} />);

    screen.getByRole("button", { name: /back to board/i }).click();

    expect(onBackToBoard).toHaveBeenCalled();
  });

  // I — Interface: a job picked in the list opens in triage, on that job
  it("opens the triage view on the job chosen in the list", () => {
    render(<InboxView pending={[job("A"), job("B"), job("C")]} onUpdate={() => {}} onBackToBoard={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));

    fireEvent.click(screen.getByText("open second"));

    expect(screen.getByTestId("triage")).toHaveTextContent("starting at B");
    expect(screen.getByRole("radio", { name: "Triage" })).toBeChecked();
  });

  it("starts triage from the top again when the user switches modes by hand", () => {
    render(<InboxView pending={[job("A"), job("B")]} onUpdate={() => {}} onBackToBoard={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    fireEvent.click(screen.getByText("open second"));
    fireEvent.click(screen.getByRole("radio", { name: "List" }));

    fireEvent.click(screen.getByRole("radio", { name: "Triage" }));

    expect(screen.getByTestId("triage")).not.toHaveTextContent("starting at");
  });
});
