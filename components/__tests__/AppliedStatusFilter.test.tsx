import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppliedStatusFilter from "@/components/AppliedStatusFilter";
import type { JobStatus } from "@/lib/jobs";

const counts = { applied: 4, screening: 2, interview: 1, offer: 0, declined: 7 };
const hiddenDeclined = new Set<JobStatus>(["declined"]);

describe("AppliedStatusFilter", () => {
  // O — One: a chip per status, with its count
  it("shows a chip for every status with its count", () => {
    render(<AppliedStatusFilter counts={counts} hidden={hiddenDeclined} onToggle={() => {}} />);

    expect(screen.getByRole("button", { name: /Declined/ })).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: /Interview/ })).toHaveTextContent("1");
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  // B — Boundary: hidden statuses read as off, shown ones as on
  it("marks hidden statuses as not pressed and the rest as pressed", () => {
    render(<AppliedStatusFilter counts={counts} hidden={hiddenDeclined} onToggle={() => {}} />);

    expect(screen.getByRole("button", { name: /Declined/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Applied/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("tells the user how many applications are hidden", () => {
    render(<AppliedStatusFilter counts={counts} hidden={hiddenDeclined} onToggle={() => {}} />);

    expect(screen.getByText("7 hidden")).toBeInTheDocument();
  });

  it("says nothing about hidden jobs when none are hidden", () => {
    render(<AppliedStatusFilter counts={counts} hidden={new Set()} onToggle={() => {}} />);

    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
  });

  // I — Interface
  it("reports which status was clicked", () => {
    const onToggle = vi.fn();
    render(<AppliedStatusFilter counts={counts} hidden={hiddenDeclined} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: /Declined/ }));

    expect(onToggle).toHaveBeenCalledWith("declined");
  });
});
