import { describe, expect, it } from "vitest";
import { linkify } from "@/lib/linkify";

describe("linkify", () => {
  it("returns no parts for empty text", () => {
    expect(linkify("")).toEqual([]);
  });

  it("returns one text part when there is no link", () => {
    expect(linkify("Remote, 5 years")).toEqual([{ type: "text", text: "Remote, 5 years" }]);
  });

  it("turns a bare https URL into a link part", () => {
    expect(linkify("See https://example.com/job/1 now")).toEqual([
      { type: "text", text: "See " },
      { type: "link", text: "https://example.com/job/1", href: "https://example.com/job/1" },
      { type: "text", text: " now" },
    ]);
  });

  it("links every URL in a list of lines", () => {
    const parts = linkify("- Glassdoor: https://a.com/x\n- LinkedIn: https://b.com/y");
    expect(parts.filter((p) => p.type === "link").map((p) => p.href)).toEqual(["https://a.com/x", "https://b.com/y"]);
  });

  it("keeps a URL's query string and comma characters", () => {
    const url = "https://www.glassdoor.com/job-listing/x_KO0,30_KE31,43.htm?jl=1010201214705";
    expect(linkify(url)).toEqual([{ type: "link", text: url, href: url }]);
  });

  it("leaves trailing punctuation and a closing parenthesis outside the link", () => {
    expect(linkify("(see https://a.com/x).")).toEqual([
      { type: "text", text: "(see " },
      { type: "link", text: "https://a.com/x", href: "https://a.com/x" },
      { type: "text", text: ")." },
    ]);
  });

  it("uses the label of a markdown link", () => {
    expect(linkify("[Glassdoor](https://a.com/x)")).toEqual([{ type: "link", text: "Glassdoor", href: "https://a.com/x" }]);
  });

  it("does not link a non-http scheme", () => {
    expect(linkify("javascript:alert(1) and [x](javascript:alert(1))")).toEqual([
      { type: "text", text: "javascript:alert(1) and [x](javascript:alert(1))" },
    ]);
  });
});
