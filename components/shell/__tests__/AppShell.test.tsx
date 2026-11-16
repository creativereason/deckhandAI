import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppShell from "@/components/shell/AppShell";
import { JOBS_CHANGED_EVENT } from "@/components/shell/assistant-context";

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
