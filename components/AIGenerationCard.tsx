"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { GenerationType } from "@/lib/prompts";
import type { TailoredResume } from "@/app/api/tailor-resume/route";

async function triggerDownload(url: string, body: Record<string, unknown>, filename: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Export failed");
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

type ModalTab = GenerationType | "tailor-resume";

const TYPE_OPTIONS: { value: ModalTab; label: string; description: string }[] = [
  { value: "cover-letter", label: "Cover letter", description: "3–4 paragraph letter ready to send" },
  { value: "tailoring-notes", label: "Tailoring notes", description: "Resume bullets and keyword recommendations" },
  { value: "tailor-resume", label: "Tailor resume", description: "AI rewrites bullets and title for this role" },
];

function DiffSection({ label, original, tailored, bullets }: { label: string; original: string[]; tailored: string[]; bullets?: boolean }) {
  const listCls = bullets ? "space-y-1 list-disc pl-4" : "space-y-1";
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-3 py-1.5 bg-muted">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="p-3 bg-destructive/5">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest mb-1.5">Before</p>
          <ul className={listCls}>
            {original.length ? original.map((b, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">{b}</li>
            )) : <li className="text-xs text-muted-foreground italic list-none">—</li>}
          </ul>
        </div>
        <div className="p-3 bg-tone-success/5">
          <p className="text-[10px] font-semibold text-tone-success uppercase tracking-widest mb-1.5">After</p>
          <ul className={listCls}>
            {tailored.length ? tailored.map((b, i) => (
              <li key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{b}</li>
            )) : <li className="text-xs text-muted-foreground italic list-none">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface Props {
  company: string;
  role: string;
  url?: string;
  hasProfile: boolean;
}

export default function AIGenerationCard({ company, role, url, hasProfile }: Props) {
  const [type, setType] = useState<ModalTab>("cover-letter");
  const [angle, setAngle] = useState("");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [originalProfile, setOriginalProfile] = useState<{
    title?: string;
    profileBullets?: string[];
    experience?: TailoredResume["experience"];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Record<string, unknown> & { title?: string; summary?: string; experience?: TailoredResume["experience"] }) => {
        setOriginalProfile({
          title: d.title as string | undefined,
          profileBullets: typeof d.summary === "string" ? [d.summary] : undefined,
          experience: d.experience,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (outputRef.current && streaming) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, streaming]);

  const generate = useCallback(async () => {
    setStreaming(true);
    setDone(false);
    setError("");
    setOutput("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, url, angle, type }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Generation failed (${res.status})`);
      }

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setDone(true);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }, [company, role, url, angle, type]);

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  }

  function downloadTxt() {
    const slugBase = `${company.toLowerCase().replace(/\s+/g, "-")}-${type}`;
    const blob = new Blob([output], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slugBase}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printPdf() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${role} — ${company}</title>
      <style>
        body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.6;
               max-width: 6.5in; margin: 1in auto; color: #111; }
        p { margin: 0 0 1em; }
        pre { white-space: pre-wrap; font-family: inherit; }
      </style>
    </head><body><pre>${output.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  async function exportCoverLetterDocx() {
    setExporting("cover-letter-docx");
    try {
      await triggerDownload("/api/export/cover-letter", { text: output, company, role }, `cover-letter-${slug}.docx`);
      toast.success("Cover letter downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function exportResumeDocx() {
    setExporting("resume-docx");
    try {
      await triggerDownload("/api/export/resume", { company, role }, `resume-${slug}.docx`);
      toast.success("Resume downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function tailorResume() {
    setTailoring(true);
    setTailored(null);
    setError("");
    try {
      const res = await fetch("/api/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, url }),
      });
      const data = await res.json() as TailoredResume & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Tailoring failed");
      setTailored(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setTailoring(false);
    }
  }

  async function exportTailoredResume() {
    if (!tailored) return;
    setExporting("tailored-resume");
    try {
      const tailoredBullets: Record<string, string[]> = {};
      for (const exp of tailored.experience) {
        tailoredBullets[`${exp.company}::${exp.role}`] = exp.bullets;
      }
      await triggerDownload(
        "/api/export/resume",
        { company, role, tailoredBullets, tailoredProfileBullets: tailored.profileBullets },
        `resume-${slug}.docx`
      );
      toast.success("Tailored resume downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const hasOutput = output.length > 0;

  if (!hasProfile) return null;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-4 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">AI Generation</p>
      </div>

      {/* Type selector */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex gap-3">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setType(opt.value); setOutput(""); setDone(false); setTailored(null); setError(""); }}
              disabled={streaming}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                type === opt.value
                  ? "border-primary bg-muted"
                  : "border-border hover:border-ring/50"
              }`}
            >
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Angle field */}
      {type !== "tailor-resume" && (
        <div className="px-6 pb-3">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Angle or emphasis <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="e.g. Emphasize design systems leadership and the Copilot agent work"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            disabled={streaming}
          />
        </div>
      )}

      {/* Job URL note */}
      {url && (
        <p className="px-6 pb-3 text-xs text-muted-foreground">
          JD: <a href={url} target="_blank" rel="noreferrer" className="underline hover:text-foreground truncate">{url}</a>
        </p>
      )}

      {/* Output — tailor-resume diff view */}
      {type === "tailor-resume" && (tailoring || tailored || error) && (
        <div className="px-6 pb-4 space-y-3">
          {error ? (
            <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-xl">{error}</p>
          ) : tailoring ? (
            <div className="flex items-center justify-center py-8 gap-3 text-sm text-muted-foreground">
              <span className="inline-block w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              Tailoring resume for {company}…
            </div>
          ) : tailored && (
            <div className="space-y-3">
              {(originalProfile?.title || tailored.title) && (
                <DiffSection
                  label="Title"
                  original={originalProfile?.title ? [originalProfile.title] : []}
                  tailored={[tailored.title]}
                />
              )}
              {(originalProfile?.profileBullets?.length || tailored.profileBullets?.length) ? (
                <DiffSection
                  label="Profile"
                  original={originalProfile?.profileBullets ?? []}
                  tailored={tailored.profileBullets ?? []}
                  bullets
                />
              ) : null}
              {tailored.experience.map((exp) => {
                const orig = originalProfile?.experience?.find(
                  (e) => e.company === exp.company && e.role === exp.role
                );
                return (
                  <DiffSection
                    key={`${exp.company}::${exp.role}`}
                    label={`${exp.role} · ${exp.company}`}
                    original={orig?.bullets ?? []}
                    tailored={exp.bullets}
                    bullets
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Output — standard textarea */}
      {type !== "tailor-resume" && (hasOutput || (error && !tailoring)) && (
        <div className="px-6 pb-4">
          {error ? (
            <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-xl">{error}</p>
          ) : (
            <textarea
              ref={outputRef}
              className="w-full min-h-[220px] border border-border rounded-xl px-4 py-3 text-sm bg-muted dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              spellCheck
            />
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="px-6 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
        {/* Left: export actions */}
        <div className="flex gap-2 flex-wrap">
          {type === "tailor-resume" ? (
            tailored && (
              <Button
                onClick={exportTailoredResume}
                disabled={!!exporting}
                loading={exporting === "tailored-resume"}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Download tailored resume .docx
              </Button>
            )
          ) : (
            <>
              {hasOutput && done && (
                <>
                  <Button onClick={copyToClipboard} variant="outline" size="sm" className="text-xs">
                    Copy
                  </Button>
                  <Button onClick={downloadTxt} variant="outline" size="sm" className="text-xs">
                    .txt
                  </Button>
                  <Button onClick={printPdf} variant="outline" size="sm" className="text-xs">
                    Print / PDF
                  </Button>
                  {type === "cover-letter" && (
                    <Button
                      onClick={exportCoverLetterDocx}
                      disabled={!!exporting}
                      loading={exporting === "cover-letter-docx"}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Cover letter .docx
                    </Button>
                  )}
                </>
              )}
              <Button
                onClick={exportResumeDocx}
                disabled={!!exporting}
                loading={exporting === "resume-docx"}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Resume .docx
              </Button>
            </>
          )}
        </div>

        {/* Right: generate button */}
        <div className="flex gap-2">
          {type === "tailor-resume" ? (
            <>
              {tailored && !tailoring && (
                <Button onClick={() => { setTailored(null); tailorResume(); }} variant="outline">
                  Re-tailor
                </Button>
              )}
              <Button onClick={tailorResume} disabled={!!tailored} loading={tailoring} size="lg" className="px-5">
                {tailoring ? "Tailoring…" : tailored ? "Tailored ✓" : "Tailor"}
              </Button>
            </>
          ) : (
            <>
              {streaming && (
                <Button onClick={stop} variant="ghost" className="hover:text-destructive">
                  Stop
                </Button>
              )}
              {!streaming && hasOutput && (
                <Button onClick={() => { setOutput(""); setDone(false); generate(); }} variant="outline">
                  Regenerate
                </Button>
              )}
              <Button onClick={generate} loading={streaming} size="lg" className="px-5">
                {streaming ? "Generating…" : hasOutput ? "Generate again" : "Generate"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
