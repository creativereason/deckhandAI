"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import type { GenerationType } from "@/lib/prompts";
import type { TailoredResume } from "@/app/api/tailor-resume/route";
import { resumeFilenameSlug } from "@/lib/resume-format";

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
  const listCls = bullets ? "flex list-disc flex-col gap-1 pl-4" : "flex flex-col gap-1";
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <h4 className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">{label}</h4>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="bg-destructive-subtle p-3">
          <p className="mb-2 text-xs font-semibold text-destructive-subtle-foreground">Before</p>
          <ul className={listCls}>
            {original.length ? original.map((b, i) => <li key={i} className="text-sm text-destructive-subtle-foreground">{b}</li>) : <li className="list-none text-sm text-muted-foreground">—</li>}
          </ul>
        </div>
        <div className="bg-success-subtle p-3">
          <p className="mb-2 text-xs font-semibold text-success-subtle-foreground">After</p>
          <ul className={listCls}>
            {tailored.length ? tailored.map((b, i) => <li key={i} className="text-sm text-success-subtle-foreground">{b}</li>) : <li className="list-none text-sm text-muted-foreground">—</li>}
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
  const [stylePdfEnabled, setStylePdfEnabled] = useState(false);
  const [resumeName, setResumeName] = useState<string | undefined>(undefined);
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
      .then((d: Record<string, unknown> & { name?: string; title?: string; summary?: string; summaryBullets?: string[]; experience?: TailoredResume["experience"] }) => {
        setOriginalProfile({
          title: d.title as string | undefined,
          profileBullets: d.summaryBullets?.length ? d.summaryBullets : (typeof d.summary === "string" && d.summary ? [d.summary] : undefined),
          experience: d.experience,
        });
        if (d.name) setResumeName(d.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { export?: { stylePdfEnabled?: boolean }; candidate?: { name?: string } }) => {
        setStylePdfEnabled(!!d.export?.stylePdfEnabled);
        setResumeName((prev) => prev ?? d.candidate?.name);
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
  const resumeSlug = resumeFilenameSlug(resumeName, company, role);

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
      await triggerDownload("/api/export/resume", { company, role }, `${resumeSlug}.docx`);
      toast.success("Resume downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function exportResumePdf() {
    setExporting("resume-pdf");
    try {
      await triggerDownload("/api/export/resume-pdf", { company, role }, `${resumeSlug}.pdf`);
      toast.success("Resume PDF downloaded");
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
      const data = await res.json().catch(() => null) as (TailoredResume & { error?: string }) | null;
      if (!res.ok || !data) throw new Error(data?.error ?? (res.ok ? "The server sent an unreadable reply. Try again." : `Tailoring failed (${res.status}). It may have timed out; try again.`));
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
        `${resumeSlug}.docx`
      );
      toast.success("Tailored resume downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function exportTailoredResumePdf() {
    if (!tailored) return;
    setExporting("tailored-resume-pdf");
    try {
      const tailoredBullets: Record<string, string[]> = {};
      for (const exp of tailored.experience) {
        tailoredBullets[`${exp.company}::${exp.role}`] = exp.bullets;
      }
      await triggerDownload(
        "/api/export/resume-pdf",
        { company, role, tailoredBullets, tailoredProfileBullets: tailored.profileBullets },
        `${resumeSlug}.pdf`
      );
      toast.success("Tailored resume PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const hasOutput = output.length > 0;

  if (!hasProfile) return null;

  const choose = (value: ModalTab) => { setType(value); setOutput(""); setDone(false); setTailored(null); setError(""); };
  const errorBox = <p role="alert" className="rounded-md bg-destructive-subtle p-3 text-sm font-medium text-destructive-subtle-foreground">{error}</p>;

  return (
    <Card padding="none" className="gap-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-ai-subtle text-ai-subtle-foreground"><Sparkles className="size-4" aria-hidden /></span>
        <CardTitle as="h2">Generate with AI</CardTitle>
      </div>

      <CardContent className="gap-4 p-4">
        <RadioGroup aria-label="What to generate" value={type} onValueChange={(v) => choose(v as ModalTab)} className="grid gap-3 sm:grid-cols-3">
          {TYPE_OPTIONS.map((opt) => <RadioItem key={opt.value} value={opt.value} label={opt.label} description={opt.description} disabled={streaming} />)}
        </RadioGroup>

        {type !== "tailor-resume" && (
          <Field label="Angle or emphasis" optional>
            {(p) => <Textarea {...p} rows={2} className="min-h-16" placeholder="e.g. Emphasize design systems leadership and the Copilot agent work" value={angle} onChange={(e) => setAngle(e.target.value)} disabled={streaming} />}
          </Field>
        )}

        {url && (
          <p className="flex min-w-0 gap-1 text-xs text-muted-foreground">
            <span className="shrink-0">Job description:</span>
            <a href={url} target="_blank" rel="noreferrer" className="min-w-0 truncate underline hover:text-foreground">{url}</a>
          </p>
        )}

        {type === "tailor-resume" && (tailoring || tailored || error) && (
          <div className="flex flex-col gap-3">
            {error ? errorBox : tailoring ? (
              <div role="status" className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-ai" aria-hidden />Tailoring resume for {company}…
              </div>
            ) : tailored && (
              <div className="flex flex-col gap-3">
                {(originalProfile?.title || tailored.title) && <DiffSection label="Title" original={originalProfile?.title ? [originalProfile.title] : []} tailored={[tailored.title]} />}
                {(originalProfile?.profileBullets?.length || tailored.profileBullets?.length) ? <DiffSection label="Profile" original={originalProfile?.profileBullets ?? []} tailored={tailored.profileBullets ?? []} bullets /> : null}
                {tailored.experience.map((exp) => {
                  const orig = originalProfile?.experience?.find((e) => e.company === exp.company && e.role === exp.role);
                  return <DiffSection key={`${exp.company}::${exp.role}`} label={`${exp.role} · ${exp.company}`} original={orig?.bullets ?? []} tailored={exp.bullets} bullets />;
                })}
              </div>
            )}
          </div>
        )}

        {type !== "tailor-resume" && (hasOutput || (error && !tailoring)) && (
          error ? errorBox : (
            <Field label="Draft">
              {(p) => <Textarea {...p} ref={outputRef} className="min-h-56 bg-muted font-mono" value={output} onChange={(e) => setOutput(e.target.value)} spellCheck />}
            </Field>
          )
        )}
      </CardContent>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
        <div className="flex flex-wrap gap-2">
          {type === "tailor-resume" ? (
            tailored && (
              <>
                <Button onClick={exportTailoredResume} disabled={!!exporting} loading={exporting === "tailored-resume"} variant="outline" size="sm">Download tailored resume .docx</Button>
                {stylePdfEnabled && <Button onClick={exportTailoredResumePdf} disabled={!!exporting} loading={exporting === "tailored-resume-pdf"} variant="outline" size="sm">Download tailored resume .pdf</Button>}
              </>
            )
          ) : (
            <>
              {hasOutput && done && (
                <>
                  <Button onClick={copyToClipboard} variant="outline" size="sm">Copy</Button>
                  <Button onClick={downloadTxt} variant="outline" size="sm">.txt</Button>
                  <Button onClick={printPdf} variant="outline" size="sm">Print / PDF</Button>
                  {type === "cover-letter" && <Button onClick={exportCoverLetterDocx} disabled={!!exporting} loading={exporting === "cover-letter-docx"} variant="outline" size="sm">Cover letter .docx</Button>}
                </>
              )}
              <Button onClick={exportResumeDocx} disabled={!!exporting} loading={exporting === "resume-docx"} variant="outline" size="sm">Resume .docx</Button>
              {stylePdfEnabled && <Button onClick={exportResumePdf} disabled={!!exporting} loading={exporting === "resume-pdf"} variant="outline" size="sm">Resume .pdf</Button>}
            </>
          )}
        </div>

        <div className="flex gap-2">
          {type === "tailor-resume" ? (
            <>
              {tailored && !tailoring && <Button onClick={() => { setTailored(null); tailorResume(); }} variant="outline">Re-tailor</Button>}
              <Button onClick={tailorResume} disabled={!!tailored} loading={tailoring} variant="ai">{tailoring ? "Tailoring…" : tailored ? "Tailored" : "Tailor"}</Button>
            </>
          ) : (
            <>
              {streaming && <Button onClick={stop} variant="ghost">Stop</Button>}
              {!streaming && hasOutput && <Button onClick={() => { setOutput(""); setDone(false); generate(); }} variant="outline">Regenerate</Button>}
              <Button onClick={generate} loading={streaming} variant="ai">{streaming ? "Generating…" : hasOutput ? "Generate again" : "Generate"}</Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
