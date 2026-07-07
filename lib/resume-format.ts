export function formatDateRange(start: string, end: string | null): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };
  return `${fmt(start)} – ${end ? fmt(end) : "Present"}`;
}

export function companySlug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function resumeFilenameSlug(name: string | undefined, company: string, role: string): string {
  return [name, company, role]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
