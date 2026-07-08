import { isPlaywrightFallbackEnabled } from "@/lib/env";

type PlaywrightModule = {
  chromium: {
    launch(options: { headless: boolean }): Promise<BrowserLike>;
  };
};
type BrowserLike = {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
};
type PageLike = {
  setContent(html: string, options: { waitUntil: "networkidle" }): Promise<unknown>;
  pdf(options: Record<string, unknown>): Promise<Buffer>;
};

interface RenderResumePdfOptions {
  html: string;
  loadPlaywrightImpl?: () => Promise<PlaywrightModule | null>;
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    return (await import("playwright")) as unknown as PlaywrightModule;
  } catch {
    return null;
  }
}

export async function renderResumePdf({
  html,
  loadPlaywrightImpl = loadPlaywright,
}: RenderResumePdfOptions): Promise<Buffer | null> {
  if (!isPlaywrightFallbackEnabled()) return null;

  const playwright = await loadPlaywrightImpl();
  if (!playwright) return null;

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.7in", bottom: "0.7in", left: "0.7in", right: "0.7in" },
    });
  } finally {
    await browser.close();
  }
}
