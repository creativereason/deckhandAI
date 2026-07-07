import { afterEach, describe, expect, it, vi } from "vitest";
import { renderResumePdf } from "@/lib/resume-pdf";

describe("renderResumePdf", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null without invoking the Playwright loader when the fallback flag is off", async () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "false");
    const loadPlaywrightImpl = vi.fn();

    // Act
    const result = await renderResumePdf({ html: "<html></html>", loadPlaywrightImpl });

    // Assert
    expect(result).toBeNull();
    expect(loadPlaywrightImpl).not.toHaveBeenCalled();
  });

  it("returns null when the flag is on but Playwright cannot be loaded", async () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const loadPlaywrightImpl = vi.fn().mockResolvedValue(null);

    // Act
    const result = await renderResumePdf({ html: "<html></html>", loadPlaywrightImpl });

    // Assert
    expect(result).toBeNull();
  });

  it("closes a fresh browser instance on each call, without leaking across calls", async () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const pdfBuffer = Buffer.from("pdf-bytes");
    const makeBrowser = () => {
      const close = vi.fn();
      const page = { setContent: vi.fn(), pdf: vi.fn().mockResolvedValue(pdfBuffer) };
      return { newPage: vi.fn().mockResolvedValue(page), close };
    };
    const browserOne = makeBrowser();
    const browserTwo = makeBrowser();
    const loadPlaywrightImpl = vi.fn().mockResolvedValue({
      chromium: { launch: vi.fn().mockResolvedValueOnce(browserOne).mockResolvedValueOnce(browserTwo) },
    });

    // Act
    await renderResumePdf({ html: "<html></html>", loadPlaywrightImpl });
    await renderResumePdf({ html: "<html></html>", loadPlaywrightImpl });

    // Assert
    expect(browserOne.close).toHaveBeenCalledTimes(1);
    expect(browserTwo.close).toHaveBeenCalledTimes(1);
  });

  it("still calls page.pdf() for an empty HTML string, deferring input validation to the caller", async () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const pdf = vi.fn().mockResolvedValue(Buffer.from("pdf-bytes"));
    const page = { setContent: vi.fn(), pdf };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const loadPlaywrightImpl = vi.fn().mockResolvedValue({ chromium: { launch: vi.fn().mockResolvedValue(browser) } });

    // Act
    await renderResumePdf({ html: "", loadPlaywrightImpl });

    // Assert
    expect(pdf).toHaveBeenCalled();
  });

  it("propagates a page.pdf() rejection rather than swallowing it", async () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const page = { setContent: vi.fn(), pdf: vi.fn().mockRejectedValue(new Error("render crash")) };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const loadPlaywrightImpl = vi.fn().mockResolvedValue({ chromium: { launch: vi.fn().mockResolvedValue(browser) } });

    // Act / Assert
    await expect(renderResumePdf({ html: "<html></html>", loadPlaywrightImpl })).rejects.toThrow("render crash");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("returns the PDF buffer from page.pdf() on the happy path", async () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const pdfBuffer = Buffer.from("pdf-bytes");
    const page = { setContent: vi.fn(), pdf: vi.fn().mockResolvedValue(pdfBuffer) };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const loadPlaywrightImpl = vi.fn().mockResolvedValue({ chromium: { launch: vi.fn().mockResolvedValue(browser) } });

    // Act
    const result = await renderResumePdf({ html: "<html></html>", loadPlaywrightImpl });

    // Assert
    expect(result).toBe(pdfBuffer);
    expect(page.setContent).toHaveBeenCalledWith("<html></html>", expect.objectContaining({ waitUntil: "networkidle" }));
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
