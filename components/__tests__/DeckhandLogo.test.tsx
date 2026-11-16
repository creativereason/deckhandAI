import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DeckhandLogo from "@/components/DeckhandLogo";

describe("DeckhandLogo", () => {
  // O — One: the simplest caller gets a named logo
  it("exposes the product name to assistive tech", () => {
    render(<DeckhandLogo />);

    expect(screen.getByText("DeckhandAI")).toBeInTheDocument();
  });

  it("renders the mark as decorative, since the name is already text", () => {
    const { container } = render(<DeckhandLogo />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  // B — Boundary: the stacked variant lays out in a column, horizontal in a row
  it("lays out in a row by default", () => {
    const { container } = render(<DeckhandLogo />);

    expect(container.firstElementChild).toHaveClass("flex-row");
  });

  it("lays out in a column when stacked", () => {
    const { container } = render(<DeckhandLogo variant="stacked" />);

    expect(container.firstElementChild).toHaveClass("flex-col");
  });

  // I — Interface: size is chosen by the caller, not hard-coded
  it("sizes the mark from the size prop", () => {
    const { container } = render(<DeckhandLogo markSize={52} />);

    expect(container.querySelector("svg")).toHaveAttribute("width", "52");
  });
});
