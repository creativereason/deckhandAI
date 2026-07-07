import { describe, it, expect } from "vitest";
import { resolveExportStyle } from "@/lib/config";

describe("resolveExportStyle", () => {
  it("returns stylePdfEnabled false when no style is given", () => {
    // Arrange
    // (no override)

    // Act
    const resolved = resolveExportStyle();

    // Assert
    expect(resolved.stylePdfEnabled).toBe(false);
  });

  it("returns stylePdfEnabled true when the override sets it true", () => {
    // Arrange
    const override = { stylePdfEnabled: true };

    // Act
    const resolved = resolveExportStyle(override);

    // Assert
    expect(resolved.stylePdfEnabled).toBe(true);
  });

  it("treats an explicit false override the same as an absent field", () => {
    // Arrange
    const withExplicitFalse = resolveExportStyle({ stylePdfEnabled: false });
    const withAbsentField = resolveExportStyle({});

    // Act / Assert
    expect(withExplicitFalse.stylePdfEnabled).toBe(withAbsentField.stylePdfEnabled);
  });
});
