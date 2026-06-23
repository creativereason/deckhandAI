"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

interface Props {
  company: string;
  role: string;
  url?: string;
  onClose: () => void;
}

type ModalTab = GenerationType | "tailor-resume";

const TYPE_OPTIONS: { value: ModalTab; label: string; description: string }[] = [
  { value: "cover-letter", label: "Cover letter", description: "3–4 paragraph letter ready to send" },
  { value: "tailoring-notes", label: "Tailoring notes", description: "Resume bullets and keyword recommendations" },
  { value: "tailor-resume", label: "Tailor resume", description: "AI rewrites bullets and title for this role" },
];

function DiffSection({ label, original, tailored }: { label: string; original: string[]; tailored: string[] }) {
  return (
    <div className="rounded-xl border border-p-linen dark:border-p-dark-mid overflow-hidden">
      <div className="px-3 py-1.5 bg-p-linen dark:bg-p-dark-mid">
        <span className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-p-linen dark:divide-p-dark-mid">
        <div className="p-3 bg-red-50/40 dark:bg-red-950/10">
          <p className="text-[10px] font-semibold text-red-400 dark:text-red-500 uppercase tracking-widest mb-1.5">Before</p>
          <ul className="space-y-1">
            {original.length ? original.map((b, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{b}</li>
            )) : <li className="text-xs text-gray-400 italic">—</li>}
          </ul>
        </div>
        <div className="p-3 bg-green-50/40 dark:bg-green-950/10">
          <p className="text-[10px] font-semibold text-green-600 dark:text-green-500 uppercase tracking-widest mb-1.5">After</p>
          <ul className="space-y-1">
            {tailored.length ? tailored.map((b, i) => (
              <li key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{b}</li>
            )) : <li className="text-xs text-gray-400 italic">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function GenerateModal({ company, role, url, onClose }: Props) {
  const [type, setType] = useState<ModalTab>("cover-letter");
  const [angle, setAngle] = useState("");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [hasProfile, setHasProfile] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  // Tailor resume state
  const [tailoring, setTailoring] = useState(false);
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [originalProfile, setOriginalProfile] = useState<{ title?: string; profileBullets?: string[]; experience?: TailoredResume["experience"] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Record<string, unknown> & { title?: string; summary?: string; experience?: TailoredResume["experience"] }) => {
        setHasProfile(!!d?.name);
        setOriginalProfile({
          title: d.title as string | undefined,
          profileBullets: typeof d.summary === "string" ? [d.summary] : undefined,
          experience: d.experience,
        });
      })
      .catch(() => {});
  }, []);

  // Scroll output to bottom as tokens arrive
  useEffect(() => {
    if (outputRef.current && streaming) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, streaming]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !streaming) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, streaming]);

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
        throw new Error(data.error ?? `Generation failed (${res.status})`);
      }

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        const chunk = decoder.decode(value, { stream: true });
        setOutput((prev) => prev + chunk);
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
    const slug = `${company.toLowerCase().replace(/\s+/g, "-")}-${type}`;
    const blob = new Blob([output], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}.txt`;
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
        { company, role, tailoredBullets },
        `resume-${slug}.docx`
      );
      toast.success("Tailored resume downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const canGenerate = !streaming;
  const hasOutput = output.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
      <div className="bg-white dark:bg-p-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-p-linen dark:border-p-dark-mid shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Generate document</h2>
            <p className="text-sm text-p-dusk dark:text-gray-400 mt-0.5">{role} — {company}</p>
          </div>
          <button
            onClick={onClose}
            disabled={streaming}
            className="text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-6 py-4 space-y-4 shrink-0">
          {/* Type selector */}
          <div className="flex gap-3">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setType(opt.value); setOutput(""); setDone(false); setTailored(null); setError(""); }}
                disabled={streaming}
                className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                  type === opt.value
                    ? "border-p-accent dark:border-p-accent-inv bg-p-light dark:bg-p-dark-mid"
                    : "border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500"
                }`}
              >
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{opt.label}</p>
                <p className="text-xs text-p-dusk dark:text-gray-400 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>

          {/* Angle / emphasis — hidden for tailor-resume */}
          {type !== "tailor-resume" && (
            <div>
              <label className="block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1">
                Angle or emphasis <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                className="w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv resize-none"
                placeholder="e.g. Emphasize design systems leadership and the Copilot agent work"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                disabled={streaming}
              />
            </div>
          )}

          {/* Job URL */}
          {url && (
            <p className="text-xs text-p-dusk dark:text-gray-400">
              JD: <a href={url} target="_blank" rel="noreferrer" className="underline hover:text-gray-700 dark:hover:text-gray-200 truncate">{url}</a>
            </p>
          )}
        </div>

        {/* Output — tailor-resume diff view */}
        {type === "tailor-resume" && (tailoring || tailored || error) && (
          <div className="px-4 sm:px-6 pb-2 flex-1 min-h-0 overflow-y-auto">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">{error}</p>
            ) : tailoring ? (
              <div className="flex items-center justify-center py-12 gap-3 text-sm text-p-dusk dark:text-gray-400">
                <span className="inline-block w-4 h-4 border-2 border-p-dusk/30 dark:border-gray-600 border-t-p-blue dark:border-t-p-accent-inv rounded-full animate-spin" />
                Tailoring resume for {company}…
              </div>
            ) : tailored && (
              <div className="space-y-5 py-2">
                {/* Title diff */}
                {(originalProfile?.title || tailored.title) && (
                  <DiffSection
                    label="Title"
                    original={originalProfile?.title ? [originalProfile.title] : []}
                    tailored={[tailored.title]}
                  />
                )}
                {/* Profile bullets diff */}
                {(originalProfile?.profileBullets?.length || tailored.profileBullets?.length) ? (
                  <DiffSection
                    label="Profile"
                    original={originalProfile?.profileBullets ?? []}
                    tailored={tailored.profileBullets ?? []}
                  />
                ) : null}
                {/* Experience diffs */}
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
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Output — standard textarea */}
        {type !== "tailor-resume" && (hasOutput || error) && (
          <div className="px-4 sm:px-6 pb-2 flex-1 min-h-0 flex flex-col">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">{error}</p>
            ) : (
              <textarea
                ref={outputRef}
                className="w-full flex-1 min-h-[200px] border border-p-linen dark:border-p-dark-mid rounded-xl px-4 py-3 text-sm bg-p-light dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv resize-none font-mono leading-relaxed"
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                spellCheck
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-p-linen dark:border-p-dark-mid flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {type === "tailor-resume" ? (
              <>
                {tailored && (
                  <button
                    onClick={exportTailoredResume}
                    disabled={!!exporting}
                    className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 border border-p-linen dark:border-p-dark-mid rounded-lg transition-colors disabled:opacity-40"
                  >
                    {exporting === "tailored-resume" ? "Exporting…" : "Download tailored resume .docx"}
                  </button>
                )}
              </>
            ) : (
              <>
                {hasOutput && done && (
                  <>
                    <button onClick={copyToClipboard} className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 border border-p-linen dark:border-p-dark-mid rounded-lg transition-colors">
                      Copy
                    </button>
                    <button onClick={downloadTxt} className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 border border-p-linen dark:border-p-dark-mid rounded-lg transition-colors">
                      .txt
                    </button>
                    <button onClick={printPdf} className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 border border-p-linen dark:border-p-dark-mid rounded-lg transition-colors">
                      Print / PDF
                    </button>
                    {hasProfile && type === "cover-letter" && (
                      <button
                        onClick={exportCoverLetterDocx}
                        disabled={!!exporting}
                        className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 border border-p-linen dark:border-p-dark-mid rounded-lg transition-colors disabled:opacity-40"
                      >
                        {exporting === "cover-letter-docx" ? "Exporting…" : "Cover letter .docx"}
                      </button>
                    )}
                  </>
                )}
                {hasProfile && (
                  <button
                    onClick={exportResumeDocx}
                    disabled={!!exporting}
                    className="text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 border border-p-linen dark:border-p-dark-mid rounded-lg transition-colors disabled:opacity-40"
                  >
                    {exporting === "resume-docx" ? "Exporting…" : "Resume .docx"}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            {type === "tailor-resume" ? (
              <>
                {tailored && !tailoring && (
                  <button
                    onClick={() => { setTailored(null); tailorResume(); }}
                    className="text-sm border border-p-linen dark:border-p-dark-mid rounded-lg px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
                  >
                    Re-tailor
                  </button>
                )}
                <button
                  onClick={tailorResume}
                  disabled={tailoring || !!tailored}
                  className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-40 transition-colors"
                >
                  {tailoring ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Tailoring…
                    </span>
                  ) : tailored ? "Tailored" : "Tailor"}
                </button>
              </>
            ) : (
              <>
                {streaming && (
                  <button onClick={stop} className="text-sm text-p-dusk dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-4 py-2 transition-colors">
                    Stop
                  </button>
                )}
                {!streaming && hasOutput && (
                  <button
                    onClick={() => { setOutput(""); setDone(false); generate(); }}
                    className="text-sm border border-p-linen dark:border-p-dark-mid rounded-lg px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
                  >
                    Regenerate
                  </button>
                )}
                <button
                  onClick={generate}
                  disabled={!canGenerate}
                  className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-40 transition-colors"
                >
                  {streaming ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating…
                    </span>
                  ) : hasOutput ? "Generate again" : "Generate"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
