import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppShell from "@/components/shell/AppShell";
import { JOBS_CHANGED_EVENT, useAssistant } from "@/components/shell/assistant-context";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const jobsWithPending = (n: number) => ({ ok: true, json: async () => ({ pending: Array.from({ length: n }, () => ({})) }) });

afterEach(() => vi.unstubAllGlobals());

describe("AppShell inbox badge", () => {
  // O — One: it shows how many jobs are waiting
  it("shows the pending count on the Inbox link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jobsWithPending(3)));

    render(<AppShell><p>page</p></AppShell>);

    await waitFor(() => expect(screen.getAllByRole("link", { name: /inbox/i })[0]).toHaveTextContent("3"));
  });

  // B — Boundary: triaging a job announces a change, and the badge follows
  it("updates the count when jobs change, without a reload", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jobsWithPending(3)).mockResolvedValue(jobsWithPending(2));
    vi.stubGlobal("fetch", fetchMock);
    render(<AppShell><p>page</p></AppShell>);
    await waitFor(() => expect(screen.getAllByRole("link", { name: /inbox/i })[0]).toHaveTextContent("3"));

    act(() => { window.dispatchEvent(new Event(JOBS_CHANGED_EVENT)); });

    await waitFor(() => expect(screen.getAllByRole("link", { name: /inbox/i })[0]).toHaveTextContent("2"));
  });

  // Z — Zero: an empty inbox shows no badge
  it("shows no count when nothing is pending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jobsWithPending(0)));

    render(<AppShell><p>page</p></AppShell>);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getAllByRole("link", { name: /inbox/i })[0]).not.toHaveTextContent(/\d/);
  });
});

function Controls() {
  const assistant = useAssistant();
  return (
    <>
      <button onClick={() => assistant.ask("Should I pursue this?", { send: true })}>ask about job</button>
      <button onClick={() => assistant.ask()}>open empty</button>
      <button onClick={assistant.close}>close panel</button>
    </>
  );
}

describe("AppShell assistant", () => {
  // B — the bug: closing and reopening the panel re-sent the last question
  it("starts a fresh chat when the panel is reopened, instead of replaying the last question", async () => {
    const chatCalls = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === "/api/chat") { chatCalls(); return { ok: true, body: new ReadableStream({ start(c) { c.close(); } }) }; }
      return jobsWithPending(0);
    }));
    render(<AppShell><Controls /></AppShell>);

    fireEvent.click(screen.getByText("ask about job"));
    await waitFor(() => expect(chatCalls).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("close panel"));
    fireEvent.click(screen.getByText("open empty"));

    await screen.findByPlaceholderText("Message…");
    await new Promise((r) => setTimeout(r, 100));
    expect(chatCalls).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Should I pursue this?")).not.toBeInTheDocument();
  });
});
