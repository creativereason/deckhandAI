"use client";
// Browser-side downloads for a job's resume and cover letter. Moved out of app/page.tsx unchanged so
// the board and the job page can share them; the API routes they call are untouched.
import { toast } from "sonner";

const slugOf = (company: string, role: string) => `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportResume(company: string, role: string) {
  try {
    const res = await fetch("/api/export/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, role }) });
    if (!res.ok) throw new Error("Export failed");
    download(await res.blob(), `resume-${slugOf(company, role)}.docx`);
  } catch {
    toast.error("Resume export failed");
  }
}

async function readAll(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

export async function exportCoverLetter(company: string, role: string, url?: string) {
  const toastId = toast.loading("Generating cover letter…");
  try {
    const genRes = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, role, url, type: "cover-letter" }) });
    if (!genRes.ok) throw new Error("Generation failed");
    if (!genRes.body) throw new Error("No response stream");
    const text = await readAll(genRes.body);
    toast.loading("Exporting…", { id: toastId });
    const docxRes = await fetch("/api/export/cover-letter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, company, role }) });
    if (!docxRes.ok) throw new Error("Export failed");
    download(await docxRes.blob(), `cover-letter-${slugOf(company, role)}.docx`);
    toast.success("Cover letter downloaded", { id: toastId });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Cover letter export failed", { id: toastId });
  }
}
