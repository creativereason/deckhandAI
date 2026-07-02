import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppHeader from "@/components/AppHeader";

describe("AppHeader", () => {
  // Z — Zero: no optional slots supplied still renders the shared chrome
  it("renders the brand link, settings link, and sign-out control with no optional props", () => {
    render(<AppHeader />);

    expect(screen.getByRole("link", { name: /DeckhandAI/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  // O — One: a single optional slot renders its content
  it("renders subtitle content when provided", () => {
    render(<AppHeader subtitle={<p>Brian&apos;s Job board</p>} />);
    expect(screen.getByText("Brian's Job board")).toBeInTheDocument();
  });

  // M — Many: multiple optional slots render independently, side by side
  it("renders subtitle and secondaryLinks together without either replacing the other", () => {
    render(
      <AppHeader
        subtitle={<p>Subtitle text</p>}
        secondaryLinks={<a href="/scrape-sources">Scraper coverage →</a>}
      />
    );
    expect(screen.getByText("Subtitle text")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scraper coverage/ })).toBeInTheDocument();
  });

  // B — Boundary: breadcrumbs are the one slot that renders a labeled nav landmark below the header row
  it("renders breadcrumbs inside a labeled nav element when provided", () => {
    render(<AppHeader breadcrumbs={<span>Board / Applied</span>} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("Board / Applied");
  });

  // I — Interface: omitting breadcrumbs means no breadcrumb nav is rendered at all
  it("does not render a breadcrumb nav when breadcrumbs is omitted", () => {
    render(<AppHeader />);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  // S — Simple: clicking Sign out calls the logout endpoint
  it("calls the logout endpoint when Sign out is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const hrefSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { get href() { return ""; }, set href(v: string) { hrefSpy(v); } },
    });

    render(<AppHeader />);
    screen.getByRole("button", { name: "Sign out" }).click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" }));
    await vi.waitFor(() => expect(hrefSpy).toHaveBeenCalledWith("/login"));

    vi.unstubAllGlobals();
  });
});
