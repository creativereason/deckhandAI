import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MarkdownContent } from "@/components/MarkdownContent";

describe("MarkdownContent", () => {
  // Z — Zero: empty input renders nothing
  it("renders no list items when given an empty string", () => {
    const { container } = render(<MarkdownContent text="" />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  // O — One: a single tight ordered-list item renders inside one <ol>
  it("renders a single ordered-list item inside one ol", () => {
    render(<MarkdownContent text="1. Only item" />);
    const ol = screen.getByRole("list");
    expect(ol.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  describe("when an ordered list has blank lines between items", () => {
    // M — Many: this is the reported bug — a "loose" list (blank line between
    // each numbered item, which LLMs commonly emit) must still collapse into
    // one <ol>, not one <ol> per item. A separate <ol> per item would make
    // every item show "1." since each new <ol> restarts its own count.
    it("collapses all items into a single ol regardless of the literal numbers used", () => {
      const text = [
        "1. Search RemoteOK",
        "",
        "1. Fetch a specific Greenhouse job",
        "",
        "1. Review your current board",
      ].join("\n");
      render(<MarkdownContent text={text} />);
      expect(screen.getAllByRole("list")).toHaveLength(1);
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    // B — Boundary: the browser's native <ol> numbering (not our own counters)
    // is what proves each item gets a distinct, incrementing number.
    it("assigns each list item a distinct position so numbering increments natively", () => {
      const text = ["1. First", "", "1. Second", "", "1. Third"].join("\n");
      render(<MarkdownContent text={text} />);
      const items = screen.getAllByRole("listitem");
      expect(items.map((li) => li.textContent)).toEqual(["First", "Second", "Third"]);
    });
  });

  describe("when an unordered list has blank lines between items", () => {
    // Same defect applies to bullet lists — less visible (no number to repeat)
    // but still wrong: it silently produces N one-item <ul>s instead of one.
    it("collapses all items into a single ul", () => {
      const text = ["- Search RemoteOK", "", "- Check the board"].join("\n");
      render(<MarkdownContent text={text} />);
      expect(screen.getAllByRole("list")).toHaveLength(1);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
  });

  // I — Interface: two genuinely separate lists (more than one blank line, or
  // intervening prose) must still stay separate, not merge into one.
  it("keeps two ordered lists separate when prose falls between them", () => {
    const text = ["1. First list item", "", "Some prose in between.", "", "1. Second list item"].join("\n");
    render(<MarkdownContent text={text} />);
    expect(screen.getAllByRole("list")).toHaveLength(2);
  });

  // E — Exception: a link with a real detailUrl still renders as a link inside a list item.
  it("renders a markdown link inside a list item as a real anchor", () => {
    render(<MarkdownContent text="1. [Anthropic](/job?section=prospect&company=Anthropic&role=Head)" />);
    expect(screen.getByRole("link", { name: "Anthropic" })).toHaveAttribute(
      "href",
      "/job?section=prospect&company=Anthropic&role=Head"
    );
  });

  // S — Simple: end-to-end happy path mirroring a real chat reply.
  it("renders a full reply with bold text, a loose ordered list, and links", () => {
    const text = [
      "You applied to **7 jobs in June**:",
      "",
      "1. Figma — [Director of Product Design](/job?section=applied&company=Figma&role=Director)",
      "",
      "2. Stripe — [Creative Director](/job?section=applied&company=Stripe&role=Creative+Director)",
    ].join("\n");
    render(<MarkdownContent text={text} />);
    expect(screen.getByText("7 jobs in June")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Director of Product Design" })).toBeInTheDocument();
  });
});
