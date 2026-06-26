"use client";
import { useEffect, useRef, useState } from "react";
import { AppliedJob, ProspectJob, PassedJob, JobSection, JobType, resolveJobType } from "@/lib/jobs";
import { getAppliedIcon, getProspectIcon } from "@/lib/job-signal";
import { SignalIcon } from "@/components/SignalIcon";

type AnyJob = AppliedJob | ProspectJob | PassedJob;

const FIT_STYLES: Record<string, string> = {
  strong: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  good: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  caution: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  weak: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_STYLES: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  screening: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  interview: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  offer: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const TYPE_STYLES: Record<JobType, string> = {
  remote: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  hybrid: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  local: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  contract: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-p-linen/60 dark:bg-p-dark-mid/60 rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold text-p-dusk dark:text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      {children}
    </div>
  );
}

interface Props {
  job: AnyJob;
  section: JobSection;
  onClose: () => void;
  onEdit: () => void;
  onGenerate?: () => void;
  onExportResume?: () => void;
  onExportCoverLetter?: () => void;
  moveSections: { value: JobSection; label: string }[];
  onMove: (target: JobSection) => void;
  onDismiss?: () => void;
}

export default function JobDetailPanel({
  job, section, onClose, onEdit, onGenerate,
  onExportResume, onExportCoverLetter, moveSections, onMove, onDismiss,
}: Props) {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isApplied = section === "applied";
  const isProspect = section === "prospect" || section === "local" || section === "staffing";
  const appliedJob = isApplied ? (job as AppliedJob) : null;
  const prospectJob = isProspect ? (job as ProspectJob) : null;

  const icon = isApplied
    ? getAppliedIcon(appliedJob!)
    : isProspect
    ? getProspectIcon(prospectJob!)
    : "🔴";

  const effectiveType = resolveJobType(section, job as ProspectJob | AppliedJob);

  // Meta grid items — only populated ones
  const metaItems: { label: string; value: string }[] = [];
  if (job.salary) metaItems.push({ label: "Salary", value: job.salary });
  if (isApplied && appliedJob!.date) metaItems.push({ label: "Applied", value: appliedJob!.date });
  if (isProspect && prospectJob!.fit) metaItems.push({ label: "Fit", value: prospectJob!.fit });
  if (effectiveType) metaItems.push({ label: "Type", value: effectiveType });

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Modal — centered card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl bg-p-light dark:bg-p-dark-surface rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-p-linen dark:border-p-dark-mid shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="leading-none mt-0.5 shrink-0 flex items-center"><SignalIcon icon={icon} size={28} /></span>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{job.company}</h2>
                  <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{job.role}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {isApplied && appliedJob!.status && (
                <Chip label={appliedJob!.status} cls={STATUS_STYLES[appliedJob!.status] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"} />
              )}
              {isProspect && prospectJob!.fit && (
                <Chip label={prospectJob!.fit} cls={FIT_STYLES[prospectJob!.fit] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"} />
              )}
              {effectiveType && (
                <Chip label={effectiveType} cls={TYPE_STYLES[effectiveType]} />
              )}
              {isApplied && appliedJob!.isGhost && (
                <Chip label="ghost risk" cls="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" />
              )}
              {isProspect && prospectJob!.isNew && (
                <Chip label="new" cls="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" />
              )}
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto text-sm text-p-accent dark:text-p-accent-inv hover:underline flex items-center gap-1 shrink-0"
                >
                  View posting
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

            {/* Meta grid */}
            {metaItems.length > 0 && (
              <div className={`grid gap-3 ${metaItems.length >= 3 ? "grid-cols-3" : metaItems.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {metaItems.map((item) => (
                  <MetaBlock key={item.label} label={item.label}>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 capitalize">{item.value}</p>
                  </MetaBlock>
                ))}
              </div>
            )}

            {/* Notes */}
            {job.notes && (
              <div>
                <p className="text-[10px] font-semibold text-p-dusk dark:text-gray-500 uppercase tracking-widest mb-2">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{job.notes}</p>
              </div>
            )}

            {/* AI Assessment */}
            {isProspect && prospectJob!.scoreRationale && (
              <div className="bg-p-linen/40 dark:bg-p-dark-mid/40 border border-p-linen dark:border-p-dark-mid rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-p-dusk dark:text-gray-500 uppercase tracking-widest mb-1.5">AI Assessment</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed">{prospectJob!.scoreRationale}</p>
              </div>
            )}
          </div>

          {/* Actions footer */}
          <div className="border-t border-p-linen dark:border-p-dark-mid px-6 py-4 shrink-0 flex items-center gap-2 flex-wrap bg-white/50 dark:bg-p-dark-surface/50">
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm font-semibold bg-p-blue dark:bg-p-accent-inv text-white rounded-lg hover:bg-p-navy dark:hover:opacity-90 transition-colors"
            >
              Edit
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              >
                ✓ Mark reviewed
              </button>
            )}
            {onGenerate && (
              <button
                onClick={onGenerate}
                className="px-4 py-2 text-sm border border-p-linen dark:border-p-dark-mid text-gray-700 dark:text-white rounded-lg hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
              >
                Generate…
              </button>
            )}
            {onExportResume && (
              <button
                onClick={onExportResume}
                className="px-4 py-2 text-sm border border-p-linen dark:border-p-dark-mid text-gray-700 dark:text-white rounded-lg hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
              >
                Resume
              </button>
            )}
            {onExportCoverLetter && (
              <button
                onClick={onExportCoverLetter}
                className="px-4 py-2 text-sm border border-p-linen dark:border-p-dark-mid text-gray-700 dark:text-white rounded-lg hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
              >
                Cover letter
              </button>
            )}
            {moveSections.length > 0 && (
              <div className="relative ml-auto">
                <button
                  ref={moveTriggerRef}
                  onClick={() => setMoveOpen((o) => !o)}
                  className="px-4 py-2 text-sm border border-p-linen dark:border-p-dark-mid text-gray-600 dark:text-gray-300 rounded-lg hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors"
                >
                  Move to ▾
                </button>
                {moveOpen && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setMoveOpen(false)} />
                    <div className="absolute bottom-full right-0 mb-2 z-[101] bg-white dark:bg-p-dark-surface border border-p-linen dark:border-p-dark-mid rounded-xl shadow-xl min-w-[160px] py-1">
                      {moveSections.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => { onMove(s.value); setMoveOpen(false); onClose(); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid"
                        >
                          → {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
