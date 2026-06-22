export const LEVEL_INCLUDE = /senior|lead|director|manager|principal|head|\bvp\b/i;
export const LEVEL_EXCLUDE = /associate|junior|intern|entry|mid-level/i;
export const TITLE_INCLUDE =
  /\bux\b|\bui\b.{0,10}design|user experience|experience design|product design|product designer|design lead|design director|service design|design manager|design ops|designops|creative director|creative lead|head of design|design system|interaction design|\bdesigner\b|product director|director.{0,10}product|head of product/i;
export const LOCATION_REMOTE = /remote/i;
export const LOCATION_LOCAL =
  /st\.? louis|chesterfield|o'?fallon|st\.? charles|wentzville|lake saint louis|creve coeur|maryland heights|ballwin|missouri|\bmo\b/i;

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

export function isQualifyingRemoteOrLocal(title: string, location: string): boolean {
  const loc = location || title;
  return (
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title) &&
    (LOCATION_REMOTE.test(loc) || LOCATION_LOCAL.test(loc))
  );
}

export function isQualifyingLocal(title: string, location: string): boolean {
  const loc = location || title;
  return (
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title) &&
    LOCATION_LOCAL.test(loc) &&
    !LOCATION_REMOTE.test(loc)
  );
}

export function isLocalListing(title: string, location: string): boolean {
  const loc = location || title;
  return LOCATION_LOCAL.test(loc) && !LOCATION_REMOTE.test(loc);
}

/**
 * @param trustLocationFilter — true when the careers URL already filters to your metro (e.g. Stifel iCIMS location)
 */
export function isQualifyingAssumeLocal(
  title: string,
  location: string,
  href = "",
  trustLocationFilter = false
): boolean {
  const loc = `${location} ${href} ${title}`;
  if (LOCATION_REMOTE.test(loc) && !LOCATION_LOCAL.test(loc)) return false;
  const titleOk =
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title);
  if (!titleOk) return false;
  if (trustLocationFilter) return true;
  return LOCATION_LOCAL.test(loc);
}
