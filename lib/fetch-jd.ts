const THIRD_PARTY_BOARDS = [
  "greenhouse.io", "lever.co", "workday.com", "myworkdayjobs.com",
  "icims.com", "taleo.net", "successfactors.com", "jobvite.com",
  "smartrecruiters.com", "brassring.com", "bamboohr.com", "recruitee.com",
  "ashbyhq.com", "rippling.com", "applytojob.com", "linkedin.com",
  "indeed.com", "glassdoor.com", "ziprecruiter.com",
];

async function fetchPageText(url: string, timeoutMs = 10000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; deckhandAI/1.0)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function homepageFromJdUrl(jdUrl: string): string | null {
  try {
    const { hostname, protocol } = new URL(jdUrl);
    if (THIRD_PARTY_BOARDS.some((b) => hostname.endsWith(b))) return null;
    const parts = hostname.split(".");
    // Strip subdomains like jobs., careers., apply., etc.
    const root = parts.length > 2 ? parts.slice(-2).join(".") : hostname;
    return `${protocol}//${root}`;
  } catch {
    return null;
  }
}

function homepageFromCompanyName(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `https://www.${slug}.com`;
}

/**
 * Fetches job description text from a URL.
 * Falls back to the company homepage if the JD page is empty, gated, or fails.
 * Returns an empty string if both attempts yield nothing.
 */
export async function fetchJdText(url: string, company?: string): Promise<string> {
  const jd = await fetchPageText(url);
  if (jd.length > 300) return jd.slice(0, 8000);

  // JD page came back thin or empty — try to get company context instead
  const homepage = homepageFromJdUrl(url) ?? (company ? homepageFromCompanyName(company) : null);
  if (!homepage) return "";
  const companyText = await fetchPageText(homepage, 8000);
  if (companyText.length > 300) {
    return `[Job description unavailable — company website context below]\n\n${companyText.slice(0, 4000)}`;
  }

  return "";
}
