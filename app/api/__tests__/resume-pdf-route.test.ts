import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/export/resume-pdf/route";
import { readConfig } from "@/lib/config-repository";
import { githubRead } from "@/lib/github";
import { renderResumePdf } from "@/lib/resume-pdf";
import type { AppConfig } from "@/lib/config";

vi.mock("@/lib/config-repository", () => ({
  readConfig: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  githubRead: vi.fn(),
}));

vi.mock("@/lib/resume-pdf", () => ({
  renderResumePdf: vi.fn(),
}));

function request(body: unknown = {}) {
  return new NextRequest("http://localhost/api/export/resume-pdf", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function configWith(stylePdfEnabled: boolean): AppConfig {
  return { export: { stylePdfEnabled } };
}

beforeEach(() => {
  vi.mocked(githubRead).mockResolvedValue(JSON.stringify({ name: "Jordan Rivera" }));
  vi.mocked(renderResumePdf).mockReset();
});

describe("POST /api/export/resume-pdf", () => {
  it("returns 400 when styled PDF export is disabled in config", async () => {
    vi.mocked(readConfig).mockResolvedValue(configWith(false));

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(renderResumePdf).not.toHaveBeenCalled();
  });

  it("returns 400 when export config is entirely absent (defaults to disabled)", async () => {
    vi.mocked(readConfig).mockResolvedValue({});

    const response = await POST(request());

    expect(response.status).toBe(400);
  });

  it("returns 503 when config allows it but the renderer returns null (Playwright unavailable)", async () => {
    vi.mocked(readConfig).mockResolvedValue(configWith(true));
    vi.mocked(renderResumePdf).mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(503);
  });

  it("returns a PDF with the correct headers on success", async () => {
    vi.mocked(readConfig).mockResolvedValue(configWith(true));
    vi.mocked(renderResumePdf).mockResolvedValue(Buffer.from("pdf-bytes"));

    const response = await POST(request({ company: "Acme Corp", role: "Design Engineer" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("jordan-rivera-acme-corp-design-engineer.pdf");
  });

  it("returns 500 with an error message when profile.json fails to parse", async () => {
    vi.mocked(readConfig).mockResolvedValue(configWith(true));
    vi.mocked(githubRead).mockResolvedValue("not json");

    const response = await POST(request());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
