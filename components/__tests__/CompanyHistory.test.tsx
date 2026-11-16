import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanyHistory, { historyFlag } from "@/components/CompanyHistory";
import { AssistantContext } from "@/components/shell/assistant-context";
import type { HistoryEntry } from "@/lib/company-history";

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({ section: "applied", storedSection: "applied", company: "Acme", role: "Designer", ...over });
const job = { company: "Acme", role: "Lead", url: "https://x.test/j", notes: "Posting" };

describe("historyFlag", () => {
  it("is null for a company never seen", () => expect(historyFlag([])).toBeNull());
  // B — the strongest fact leads, whatever order the entries come in
  it("puts 'Applied before' ahead of passed and prospects", () => {
    expect(historyFlag([entry({ section: "passed" }), entry({ section: "applied" })])?.label).toBe("Applied before");
  });
  it("flags a passed company and a prospect company", () => {
    expect(historyFlag([entry({ section: "passed" })])?.label).toBe("Passed before");
    expect(historyFlag([entry({ section: "prospect" })])?.label).toBe("Already in prospects");
  });
  it("does not flag a company that only appears elsewhere in the inbox", () => {
    expect(historyFlag([entry({ section: "pending" })])).toBeNull();
  });
});

describe("CompanyHistory", () => {
  // Z
  it("says it is the first time when the board has nothing", () => {
    render(<CompanyHistory job={job} entries={[]} />);

    expect(screen.getByText(/first time seeing acme/i)).toBeInTheDocument();
  });
  // M
  it("lists earlier roles with their section, status and a link to the job", () => {
    render(<CompanyHistory job={job} entries={[entry({ status: "interview", date: "2026-05-02", id: "a1" }), entry({ section: "passed", storedSection: "passed", role: "Director" })]} />);

    expect(screen.getByRole("link", { name: /Designer/ })).toHaveAttribute("href", expect.stringContaining("/job?"));
    expect(screen.getByText("Interview")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });
  it("shows another inbox job as text, not a link, since it has no page yet", () => {
    render(<CompanyHistory job={job} entries={[entry({ section: "pending", storedSection: "pending", role: "Other" })]} />);

    expect(screen.getByText("Also in your inbox")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Other/ })).not.toBeInTheDocument();
  });
  // I — the AI question carries the job
  it("asks the assistant, with this job as context", () => {
    const ask = vi.fn();
    render(<AssistantContext.Provider value={{ open: false, ask, close: () => {} }}><CompanyHistory job={job} entries={[]} /></AssistantContext.Provider>);

    fireEvent.click(screen.getByRole("button", { name: /ask about my history/i }));

    expect(ask).toHaveBeenCalledWith(expect.stringMatching(/applied to anything at Acme before/), expect.objectContaining({ send: true, context: expect.objectContaining({ label: "Acme · Lead" }) }));
  });
});
