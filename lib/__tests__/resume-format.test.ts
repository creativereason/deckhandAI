import { describe, it, expect } from "vitest";
import { formatDateRange, companySlug } from "@/lib/resume-format";

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
