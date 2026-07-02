import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppFooter from "@/components/AppFooter";

describe("AppFooter", () => {
  // O — One: renders the attribution link to the original creator
  it("links to the creativereason site", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "creativereason" })).toHaveAttribute(
      "href",
      "https://creativereason.com"
    );
  });

  // M — Many: renders all three external links with safe target/rel attributes
  it("opens the GitHub and license links in a new tab without leaking a window reference", () => {
    render(<AppFooter />);
    const github = screen.getByRole("link", { name: "GitHub" });
    const license = screen.getByRole("link", { name: "MIT License" });

    for (const link of [github, license]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(github).toHaveAttribute("href", "https://github.com/creativereason/deckhandAI");
    expect(license).toHaveAttribute(
      "href",
      "https://github.com/creativereason/deckhandAI/blob/main/LICENSE"
    );
  });
});
