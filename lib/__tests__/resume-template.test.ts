import { describe, it, expect } from "vitest";
import { buildResumeHtml } from "@/lib/resume-template";
import type { ProfileData } from "@/lib/docx-resume";
import type { CandidateConfig } from "@/lib/config";

const candidate: CandidateConfig = {
  name: "Jordan Rivera",
  email: "jordan@example.com",
  phone: "555.123.4567",
};

describe("buildResumeHtml", () => {
  it("renders just the name and an empty experience section is omitted for a minimal profile", () => {
    // Arrange
    const profile: ProfileData = {};

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    expect(html).toContain("<h1>Jordan Rivera</h1>");
    expect(html).not.toContain("<h2>Experience</h2>");
    expect(html).not.toContain("<h2>Skills</h2>");
    expect(html).not.toContain("<h2>Awards</h2>");
    expect(html).not.toContain("<h2>Education</h2>");
  });

  it("renders one experience role as a title, employer, dates, and bullet list", () => {
    // Arrange
    const profile: ProfileData = {
      experience: [
        {
          company: "Anthropic",
          role: "Staff Designer",
          start: "2023-01",
          end: null,
          bullets: ["Shipped the thing."],
        },
      ],
    };

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    expect(html).toContain("<h2>Experience</h2>");
    expect(html).toContain("<h3>Staff Designer</h3>");
    expect(html).toContain("Anthropic");
    expect(html).toContain("January 2023 – Present");
    expect(html).toContain("<li>Shipped the thing.</li>");
  });

  it("renders multiple experience roles in the given order", () => {
    // Arrange
    const profile: ProfileData = {
      experience: [
        { company: "First Co", role: "Role One", start: "2022-01", end: "2023-01", bullets: [] },
        { company: "Second Co", role: "Role Two", start: "2020-01", end: "2022-01", bullets: [] },
      ],
    };

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    const firstIndex = html.indexOf("Role One");
    const secondIndex = html.indexOf("Role Two");
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });

  it("escapes HTML-significant characters in bullet text", () => {
    // Arrange
    const profile: ProfileData = {
      experience: [
        {
          company: "AT&T",
          role: "Engineer",
          start: "2020-01",
          end: "2021-01",
          bullets: ["Improved <checkout> flow for R&D team"],
        },
      ],
    };

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    expect(html).toContain("AT&amp;T");
    expect(html).toContain("Improved &lt;checkout&gt; flow for R&amp;D team");
    expect(html).not.toContain("<checkout>");
  });

  it("wraps each experience role in a break-inside: avoid block", () => {
    // Arrange
    const profile: ProfileData = {
      experience: [
        { company: "Anthropic", role: "Staff Designer", start: "2023-01", end: null, bullets: [] },
      ],
    };

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    expect(html).toMatch(/break-inside:\s*avoid/);
  });

  it("omits education, awards, and skills sections when those fields are absent", () => {
    // Arrange
    const profile: ProfileData = { experience: [] };

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    expect(html).not.toContain("<h2>Education</h2>");
    expect(html).not.toContain("<h2>Awards</h2>");
    expect(html).not.toContain("<h2>Skills</h2>");
  });

  it("renders a full profile end to end with sections in Profile, Skills, Experience, Awards, Education order", () => {
    // Arrange
    const profile: ProfileData = {
      summary: "Fifteen years of design leadership.",
      strengths: ["Design Systems", "DesignOps"],
      experience: [
        { company: "Anthropic", role: "Staff Designer", start: "2023-01", end: null, bullets: ["Did a thing."] },
      ],
      awards: ["Best in Show — Design Awards, 2020"],
      education: [
        { institution: "State University", degree: "B.A. Design", graduated: "2010-05", honors: "Cum Laude" },
      ],
    };

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    const order = ["<h2>Profile</h2>", "<h2>Skills</h2>", "<h2>Experience</h2>", "<h2>Awards</h2>", "<h2>Education</h2>"];
    const indices = order.map((marker) => html.indexOf(marker));
    expect(indices.every((i) => i > -1)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(html).toContain("State University");
    expect(html).toContain("Best in Show");
  });

  it("appends a company-specific portfolio link when both portfolio_url and company are given", () => {
    // Arrange
    const profile: ProfileData = { portfolio_url: "https://example.com/p/" };

    // Act
    const html = buildResumeHtml(profile, candidate, { company: "Acme Corp" });

    // Assert
    expect(html).toContain("Portfolio: https://example.com/p/acme-corp");
  });

  it("renders tailoredProfileBullets as a list instead of the summary paragraph when provided", () => {
    // Arrange
    const profile: ProfileData = { summary: "Should not appear." };

    // Act
    const html = buildResumeHtml(profile, candidate, { tailoredProfileBullets: ["Tailored bullet one."] });

    // Assert
    expect(html).toContain("<li>Tailored bullet one.</li>");
    expect(html).not.toContain("Should not appear.");
  });

  it("embeds Inter as a real base64 font-face, not a bare font-family reference", () => {
    // Arrange
    const profile: ProfileData = {};

    // Act
    const html = buildResumeHtml(profile, candidate);

    // Assert
    expect(html).toMatch(/@font-face/);
    expect(html).toMatch(/data:font\/woff2;base64,[A-Za-z0-9+/]{100,}/);
  });
});
