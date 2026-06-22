export const LEVEL_INCLUDE = /senior|lead|director|manager|principal|head|\bvp\b/i;
export const LEVEL_EXCLUDE = /associate|junior|intern|entry|mid-level/i;
export const TITLE_INCLUDE =
  /\bux\b|\bui\b.{0,10}design|user experience|experience design|product design|product designer|design lead|design director|service design|design manager|design ops|designops|creative director|creative lead|head of design|design system|interaction design|\bdesigner\b|product director|director.{0,10}product|head of product/i;
export const LOCATION_REMOTE = /remote/i;

export const DEFAULT_SELECTORS = [
  ".job-title a",
  ".job-title",
  "[data-automation-id='jobTitle']",
  ".opening-title a",
  ".opening-title",
  ".posting-title",
  ".job-listing-title",
  "h3 a[href*='job']",
];

/**
 * Build a local location regex from the user's hub city and state.
 * Falls back to matching nothing if no hub is configured.
 */
export function buildLocalRegex(hubCity?: string, hubState?: string): RegExp {
  if (!hubCity && !hubState) return /(?!)/; // never matches
  const terms = [hubCity, hubState].filter(Boolean).map((t) =>
    t!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(terms.join("|"), "i");
}

export function isQualifyingRemoteOrLocal(
  title: string,
  location: string,
  localRegex: RegExp
): boolean {
  const loc = location || title;
  return (
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title) &&
    (LOCATION_REMOTE.test(loc) || localRegex.test(loc))
  );
}

export function isQualifyingLocal(
  title: string,
  location: string,
  localRegex: RegExp
): boolean {
  const loc = location || title;
  return (
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title) &&
    localRegex.test(loc) &&
    !LOCATION_REMOTE.test(loc)
  );
}

export function isLocalListing(
  title: string,
  location: string,
  localRegex: RegExp
): boolean {
  const loc = location || title;
  return localRegex.test(loc) && !LOCATION_REMOTE.test(loc);
}

/**
 * @param trustLocationFilter — true when the careers URL already filters to the user's metro
 */
export function isQualifyingAssumeLocal(
  title: string,
  location: string,
  localRegex: RegExp,
  href = "",
  trustLocationFilter = false
): boolean {
  const loc = `${location} ${href} ${title}`;
  if (LOCATION_REMOTE.test(loc) && !localRegex.test(loc)) return false;
  const titleOk =
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title);
  if (!titleOk) return false;
  if (trustLocationFilter) return true;
  return localRegex.test(loc);
}
