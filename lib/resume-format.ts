export function formatDateRange(start: string, end: string | null, location?: string): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };
  const range = `${fmt(start)} – ${end ? fmt(end) : "Present"}`;
  return location ? `${range} | ${location}` : range;
}

export function companySlug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const LEADING_BULLET_MARKER = /^[\s]*[•·*-]\s*/;

export function linesToBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(LEADING_BULLET_MARKER, "").trim())
    .filter(Boolean);
}

export function resumeFilenameSlug(name: string | undefined, company: string, role: string): string {
  return [name, company, role]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
