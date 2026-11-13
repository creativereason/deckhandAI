import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InboxView from "@/components/InboxView";
import type { PendingJob } from "@/lib/jobs";

vi.mock("@/components/ScrapeReviewQueue", () => ({
  default: ({ pending }: { pending: PendingJob[] }) => <div data-testid="queue">{pending.length} in queue</div>,
}));

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

  // M — Many
  it("renders every pending job in the review queue", () => {
    render(<InboxView pending={[job("A"), job("B"), job("C")]} onUpdate={() => {}} onBackToBoard={() => {}} />);

    expect(screen.getByTestId("queue")).toHaveTextContent("3 in queue");
  });

  // S — Simple: the empty state offers a way out
  it("offers a way back to the board from the empty state", () => {
    const onBackToBoard = vi.fn();
    render(<InboxView pending={[]} onUpdate={() => {}} onBackToBoard={onBackToBoard} />);

    screen.getByRole("button", { name: /back to board/i }).click();

    expect(onBackToBoard).toHaveBeenCalled();
  });
});
