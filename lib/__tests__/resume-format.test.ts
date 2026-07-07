import { describe, it, expect } from "vitest";
import { formatDateRange, companySlug, linesToBullets } from "@/lib/resume-format";

describe("companySlug", () => {
  it("returns an empty string for empty input", () => {
    // Arrange
    const company = "";

    // Act
    const slug = companySlug(company);

    // Assert
    expect(slug).toBe("");
  });

  it("lowercases a single-word company name", () => {
    // Arrange
    const company = "Anthropic";

    // Act
    const slug = companySlug(company);

    // Assert
    expect(slug).toBe("anthropic");
  });

  it("hyphenates a multi-word company name with punctuation", () => {
    // Arrange
    const company = "J.P. Morgan & Co.";

    // Act
    const slug = companySlug(company);

    // Assert
    expect(slug).toBe("j-p-morgan-co");
  });

  it("never leaves a leading or trailing hyphen", () => {
    // Arrange
    const company = "  -Rocket Companies-  ";

    // Act
    const slug = companySlug(company);

    // Assert
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("formatDateRange", () => {
  it("formats a single-month range as one month spelled out on both ends", () => {
    // Arrange
    const start = "2024-01";
    const end = "2024-01";

    // Act
    const range = formatDateRange(start, end);

    // Assert
    expect(range).toBe("January 2024 – January 2024");
  });

  it("formats a start and end month across a full range", () => {
    // Arrange
    const start = "2017-05";
    const end = "2022-11";

    // Act
    const range = formatDateRange(start, end);

    // Assert
    expect(range).toBe("May 2017 – November 2022");
  });

  it("renders 'Present' when end is null", () => {
    // Arrange
    const start = "2024-10";
    const end = null;

    // Act
    const range = formatDateRange(start, end);

    // Assert
    expect(range).toBe("October 2024 – Present");
  });

  it("formats December correctly at the year boundary", () => {
    // Arrange
    const start = "2011-12";
    const end = "2012-01";

    // Act
    const range = formatDateRange(start, end);

    // Assert
    expect(range).toBe("December 2011 – January 2012");
  });
});

describe("linesToBullets", () => {
  it("returns an empty array for an empty string", () => {
    // Arrange
    const text = "";

    // Act
    const bullets = linesToBullets(text);

    // Assert
    expect(bullets).toEqual([]);
  });

  it("returns a single bullet for one plain line", () => {
    // Arrange
    const text = "20+ years leading enterprise UX";

    // Act
    const bullets = linesToBullets(text);

    // Assert
    expect(bullets).toEqual(["20+ years leading enterprise UX"]);
  });

  it("strips a leading bullet marker and surrounding whitespace from each line", () => {
    // Arrange
    const text = "•    20+ years leading enterprise UX\n•    Proven track record building teams";

    // Act
    const bullets = linesToBullets(text);

    // Assert
    expect(bullets).toEqual(["20+ years leading enterprise UX", "Proven track record building teams"]);
  });

  it("drops blank lines between bullets", () => {
    // Arrange
    const text = "• First point\n\n• Second point\n   \n• Third point";

    // Act
    const bullets = linesToBullets(text);

    // Assert
    expect(bullets).toEqual(["First point", "Second point", "Third point"]);
  });

  it("strips hyphen and asterisk bullet markers as well as the dot leader character", () => {
    // Arrange
    const text = "- Dash bullet\n* Asterisk bullet\n· Dot bullet";

    // Act
    const bullets = linesToBullets(text);

    // Assert
    expect(bullets).toEqual(["Dash bullet", "Asterisk bullet", "Dot bullet"]);
  });

  it("does not strip a hyphen that is part of the sentence rather than a leading marker", () => {
    // Arrange
    const text = "Twenty-five years of cross-functional leadership";

    // Act
    const bullets = linesToBullets(text);

    // Assert
    expect(bullets).toEqual(["Twenty-five years of cross-functional leadership"]);
  });
});
