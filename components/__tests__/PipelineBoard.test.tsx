import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import PipelineBoard from "@/components/PipelineBoard";
import type { PipelineColumn } from "@/lib/pipeline";

const columns: PipelineColumn[] = [
  { id: "prospect", title: "Prospects", cards: [{ key: "p1", id: "p1", company: "Acme", role: "Design Lead", summary: "Leads a team.", fit: "strong", salary: "$150k", section: "prospect" }] },
  { id: "applied", title: "Applied", cards: [] },
  { id: "interview", title: "Interview", cards: [{ key: "a1", id: "a1", company: "Bravo", role: "Director", salary: "", section: "applied", status: "interview" }] },
];
const setup = (over = {}) => {
  const props = { columns, passedCount: 4, onMove: vi.fn(), onOpen: vi.fn(), ...over };
  render(<PipelineBoard {...props} />);
  return props;
};

describe("PipelineBoard", () => {
  // Z
  it("shows an empty column with its heading and a zero count", () => {
    setup();

    const applied = screen.getByRole("region", { name: "Applied" });
    expect(within(applied).getByText("0")).toBeInTheDocument();
    expect(within(applied).queryByRole("article")).not.toBeInTheDocument();
  });

  // O
  it("shows a card with company, role, summary, fit and salary", () => {
    setup();

    const prospects = screen.getByRole("region", { name: "Prospects" });
    for (const text of ["Acme", "Design Lead", "Leads a team.", "strong", "$150k"]) expect(within(prospects).getByText(text)).toBeInTheDocument();
  });

  // M
  it("puts each card in its own column with the column's count", () => {
    setup();

    expect(within(screen.getByRole("region", { name: "Interview" })).getByText("Bravo")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Interview" })).getByText("1")).toBeInTheDocument();
  });

  // I — moving without a mouse
  it("moves a card from its 'Move to' menu, which works from the keyboard", () => {
    const { onMove } = setup();

    fireEvent.change(screen.getByLabelText("Move Acme to"), { target: { value: "interview" } });

    expect(onMove).toHaveBeenCalledWith(columns[0].cards[0], "interview");
  });

  it("offers Passed in the menu but not the card's own column", () => {
    setup();

    const options = within(screen.getByLabelText("Move Acme to")).getAllByRole("option").map((o) => o.textContent);

    expect(options).toContain("Passed");
    expect(options).not.toContain("Prospects");
  });

  it("moves a card dragged onto another column", () => {
    const { onMove } = setup();
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => { data[k] = v; }, getData: (k: string) => data[k], effectAllowed: "" };

    fireEvent.dragStart(screen.getByText("Acme").closest("article")!, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Applied" }), { dataTransfer });

    expect(onMove).toHaveBeenCalledWith(columns[0].cards[0], "applied");
  });

  it("opens a job from its company name", () => {
    const { onOpen } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Acme" }));

    expect(onOpen).toHaveBeenCalledWith(columns[0].cards[0]);
  });

  it("links to the Passed jobs with their count", () => {
    setup();

    expect(screen.getByText(/passed 4/i)).toBeInTheDocument();
  });
});
