import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BoardViewSwitch from "@/components/BoardViewSwitch";

describe("BoardViewSwitch", () => {
  // Z — Zero: an empty inbox shows no count but the control stays
  it("shows both tabs and no count badge when the inbox is empty", () => {
    render(<BoardViewSwitch view="board" pendingCount={0} onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: "Board" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Inbox" })).toBeInTheDocument();
  });

  // O — One
  it("shows the pending count on the inbox tab", () => {
    render(<BoardViewSwitch view="board" pendingCount={67} onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: /Inbox/ })).toHaveTextContent("67");
  });

  // I — Interface: the selected tab is exposed to assistive tech
  it("marks the active view as selected", () => {
    render(<BoardViewSwitch view="inbox" pendingCount={3} onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Board" })).toHaveAttribute("aria-selected", "false");
  });

  // S — Simple: clicking a tab asks for that view
  it("calls onChange with the chosen view", () => {
    const onChange = vi.fn();
    render(<BoardViewSwitch view="board" pendingCount={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /Inbox/ }));

    expect(onChange).toHaveBeenCalledWith("inbox");
  });
});
