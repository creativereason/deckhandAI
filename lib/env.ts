export function isPlaywrightFallbackEnabled(): boolean {
  return process.env.ENABLE_PLAYWRIGHT_FALLBACK === "true";
}
