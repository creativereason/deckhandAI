"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AddJobModal from "@/components/AddJobModal";
import JobFormModal from "@/components/JobFormModal";
import OnboardingWizard from "@/components/OnboardingWizard";
import ScrapeReviewQueue from "@/components/ScrapeReviewQueue";
import GenerateModal from "@/components/GenerateModal";
import ScrapePanel from "@/components/ScrapePanel";
import GenericScrapePanel from "@/components/GenericScrapePanel";
import SortableTh from "@/components/SortableTh";
import {
  JobsData,
  AppliedJob,
  ProspectJob,
  PassedJob,
  JobSection,
  JobFit,
  JobType,
} from "@/lib/jobs";
import { nextSort, sortRows, type SortState } from "@/lib/table-sort";
import { getAppliedIcon, getProspectIcon, iconSortKey } from "@/lib/job-signal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import ChatDrawer from "@/components/ChatDrawer";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FitFilter = JobFit | "all";
type TaggedProspectJob = ProspectJob & { _section: "prospect" | "local" | "staffing" };

function getProspectType(job: TaggedProspectJob): JobType {
  if (job.type) return job.type;
  if (job._section === "staffing") return "contract";
  if (job._section === "local") return "hybrid";
  return "remote";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIT_OPTIONS: { value: FitFilter; label: string; active: string; inactive: string }[] = [
  { value: "all", label: "All", active: "bg-p-blue text-white border-p-blue dark:bg-p-accent-inv dark:text-white dark:border-p-accent-inv", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "strong", label: "Strong", active: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "good", label: "Good", active: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "caution", label: "Caution", active: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "weak", label: "Weak", active: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
];

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

const DEFAULT_SORT: SortState = { column: "signal", dir: "asc" };

const DISPLAY_SECTIONS: { value: JobSection; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "prospect", label: "Prospects" },
  { value: "passed", label: "Passed" },
];

// ─── Shared small components ──────────────────────────────────────────────────

function FitBadge({ label }: { label?: string }) {
  if (!label) return <span className="text-stone-300 dark:text-p-dark-mid">—</span>;
  const cls = FIT_STYLES[label.toLowerCase()] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ label }: { label?: string }) {
  if (!label) return <span className="text-stone-300 dark:text-p-dark-mid">—</span>;
  const cls = STATUS_STYLES[label.toLowerCase()] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type?: JobType }) {
  if (!type) return null;
  const cls = TYPE_STYLES[type] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize shrink-0 ${cls}`}>
      {type}
    </span>
  );
}

function NewChip() {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 border border-orange-200 ml-1.5 leading-none">
      New
    </span>
  );
}

function RowIcon({ icon }: { icon: string }) {
  return (
    <td className="py-2.5 pr-2 text-base leading-none w-6 text-center select-none">{icon}</td>
  );
}

function JobLink({ url }: { url: string }) {
  if (!url) return <span className="text-gray-300">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-p-accent dark:text-p-accent-inv hover:opacity-80 underline text-sm">
      link
    </a>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function RowActions({ onEdit, onGenerate, onExportResume, onExportCoverLetter, moveSections, onMove, onDismiss }: {
  onEdit: () => void;
  onGenerate?: () => void;
  onExportResume?: () => void;
  onExportCoverLetter?: () => void;
  moveSections: { value: JobSection; label: string }[];
  onMove: (t: JobSection) => void;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasMenu = !!(onDismiss || onGenerate || onExportCoverLetter || onExportResume || moveSections.length);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="text-sm text-p-dusk dark:text-gray-400 hover:text-p-blue dark:hover:text-white px-1.5 py-0.5 rounded transition-colors"
      >
        Edit
      </button>
      {hasMenu && (
        <div className="relative">
          <button
            ref={triggerRef}
            onClick={handleToggle}
            className="w-6 h-6 flex items-center justify-center rounded text-p-dusk dark:text-gray-400 hover:text-p-blue dark:hover:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors text-base leading-none"
          >
            ⋮
          </button>
          {open && menuPos && (
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
              <div
                className="fixed z-[101] bg-white dark:bg-p-dark-surface border border-p-linen dark:border-p-dark-mid rounded-lg shadow-xl min-w-[160px] py-1"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                {onDismiss && (
                  <button
                    onClick={() => { onDismiss(); setOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-p-linen dark:hover:bg-p-dark-mid"
                  >
                    ✓ Mark reviewed
                  </button>
                )}
                {onDismiss && (onGenerate || onExportCoverLetter || onExportResume) && (
                  <div className="h-px bg-p-linen dark:bg-p-dark-mid my-1" />
                )}
                {onGenerate && (
                  <button
                    onClick={() => { onGenerate(); setOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid"
                  >
                    Generate…
                  </button>
                )}
                {onExportCoverLetter && (
                  <button
                    onClick={() => { onExportCoverLetter(); setOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid"
                  >
                    Cover letter
                  </button>
                )}
                {onExportResume && (
                  <button
                    onClick={() => { onExportResume(); setOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid"
                  >
                    Resume
                  </button>
                )}
                {moveSections.length > 0 && (
                  <>
                    <div className="h-px bg-p-linen dark:bg-p-dark-mid my-1" />
                    <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-gray-500">Move to</p>
                    {moveSections.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => { onMove(s.value); setOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid"
                      >
                        → {s.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, visibleCount, newCount }: {
  title: string;
  count: number;
  visibleCount?: number;
  newCount?: number;
}) {
  const filtered = visibleCount !== undefined && visibleCount !== count;
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <span className="text-xs font-semibold text-p-blue dark:text-p-accent-inv uppercase tracking-widest">{title}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs font-medium text-stone-500 dark:text-gray-400 bg-p-linen dark:bg-p-dark-mid rounded-full px-2 py-0.5 tabular-nums">
          {filtered ? `${visibleCount} / ${count}` : count}
        </span>
        {!!newCount && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 border border-orange-200 leading-none">
            {newCount} new
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Fit filter bar ───────────────────────────────────────────────────────────

function FitFilterBar({ active, onChange }: { active: FitFilter; onChange: (f: FitFilter) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-p-dusk dark:text-p-accent-inv font-medium mr-1 uppercase tracking-widest">Fit:</span>
      {FIT_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all",
            active === opt.value ? opt.active : opt.inactive
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Edit / detail state ──────────────────────────────────────────────────────

type EditState = { section: JobSection; job: AppliedJob | ProspectJob | PassedJob; jobType?: JobType };

// ─── Applied table ────────────────────────────────────────────────────────────

function AppliedTable({ jobs, otherSections, onEdit, onMove, onGenerate, onExportResume, onExportCoverLetter, onDetail }: {
  jobs: AppliedJob[];
  otherSections: { value: JobSection; label: string }[];
  onEdit: (job: AppliedJob) => void;
  onMove: (target: JobSection, job: AppliedJob) => void;
  onGenerate?: (job: AppliedJob) => void;
  onExportResume?: (job: AppliedJob) => void;
  onExportCoverLetter?: (job: AppliedJob) => void;
  onDetail: (job: AppliedJob) => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const sorted = useMemo(
    () => sortRows(jobs, sort, (j, col) =>
      col === "signal" ? iconSortKey(getAppliedIcon(j)) : String(j[col as keyof AppliedJob] ?? "")),
    [jobs, sort]
  );

  function handleMove(target: JobSection, j: AppliedJob) {
    const key = `${j.company}${j.role}`;
    const label = DISPLAY_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(target, j), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">No applications yet.</p>;
  return (
    <>
      {/* Mobile/tablet cards */}
      <div className="lg:hidden space-y-2 pb-1">
        {sorted.map((j) => {
          const key = `${j.company}${j.role}`;
          return (
            <div key={key}
              onClick={() => onDetail(j)}
              className={cn(
                "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300 cursor-pointer hover:border-p-dusk dark:hover:border-gray-500",
                exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
              )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base leading-none shrink-0">{getAppliedIcon(j)}</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-base truncate">{j.company}</span>
                  <StatusBadge label={j.status} />
                  {j.type && <TypeBadge type={j.type} />}
                </div>
                {j.url && <JobLink url={j.url} />}
              </div>
              <p className="text-base text-gray-700 dark:text-gray-200 mt-1 leading-snug">{j.role}</p>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-stone-500 dark:text-gray-400">
                {j.date && <span>{j.date}</span>}
                {j.salary && <span>{j.salary}</span>}
              </div>
              {j.notes && <p className="text-sm text-stone-400 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{j.notes}</p>}
              <div className="mt-2 pt-2 border-t border-p-linen dark:border-p-dark-mid">
                <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)}
                  onGenerate={onGenerate ? () => onGenerate(j) : undefined}
                  onExportResume={onExportResume ? () => onExportResume(j) : undefined}
                  onExportCoverLetter={onExportCoverLetter ? () => onExportCoverLetter(j) : undefined} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <table className="hidden lg:table w-full text-sm">
        <thead>
          <tr className="text-xs text-p-dusk dark:text-gray-400 uppercase tracking-widest border-b border-p-linen dark:border-p-dark-mid">
            <SortableTh label="Signal" column="signal" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium w-6" />
            <SortableTh label="Company" column="company" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Role" column="role" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Status" column="status" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Type" column="type" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Date" column="date" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Salary" column="salary" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Notes" column="notes" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Job Link" column="url" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium" />
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => (
            <tr key={`${j.company}${j.role}`}
              onClick={() => onDetail(j)}
              className="border-b border-p-linen/60 dark:border-p-dark-mid/60 hover:bg-p-linen/40 dark:hover:bg-p-dark-mid/40 group cursor-pointer">
              <RowIcon icon={getAppliedIcon(j)} />
              <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{j.company}</td>
              <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-200">{j.role}</td>
              <td className="py-2.5 pr-4"><StatusBadge label={j.status} /></td>
              <td className="py-2.5 pr-4">{j.type ? <TypeBadge type={j.type} /> : <span className="text-stone-300">—</span>}</td>
              <td className="py-2.5 pr-4 text-stone-500 dark:text-gray-400 whitespace-nowrap">{j.date || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-500 dark:text-gray-400 max-w-[120px] text-xs">{j.salary || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[220px] text-xs leading-relaxed truncate">{j.notes}</td>
              <td className="py-2.5 pr-2"><JobLink url={j.url} /></td>
              <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)}
                  onGenerate={onGenerate ? () => onGenerate(j) : undefined}
                  onExportResume={onExportResume ? () => onExportResume(j) : undefined}
                  onExportCoverLetter={onExportCoverLetter ? () => onExportCoverLetter(j) : undefined} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ─── Prospects table ──────────────────────────────────────────────────────────

function ProspectTable({ jobs, onMove, onEdit, onDismiss, onGenerate, onExportResume, onExportCoverLetter, otherSections, onDetail }: {
  jobs: TaggedProspectJob[];
  onMove: (from: JobSection, company: string, role: string, to: JobSection) => void;
  onEdit: (job: ProspectJob) => void;
  onDismiss: (job: ProspectJob) => void;
  onGenerate: (job: ProspectJob) => void;
  onExportResume?: (job: ProspectJob) => void;
  onExportCoverLetter?: (job: ProspectJob) => void;
  otherSections: { value: JobSection; label: string }[];
  onDetail: (job: TaggedProspectJob) => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const sorted = useMemo(
    () => sortRows(jobs, sort, (j, col) =>
      col === "signal" ? iconSortKey(getProspectIcon(j)) : String(j[col as keyof ProspectJob] ?? "")),
    [jobs, sort]
  );

  function handleMove(target: JobSection, j: TaggedProspectJob) {
    const key = `${j.company}${j.role}`;
    const label = DISPLAY_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(j._section, j.company, j.role, target), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">No roles match the current filter.</p>;
  return (
    <>
      {/* Mobile/tablet cards */}
      <div className="lg:hidden space-y-2 pb-1">
        {sorted.map((j) => {
          const key = `${j.company}${j.role}`;
          const jType = getProspectType(j);
          return (
            <div key={key}
              onClick={() => onDetail(j)}
              className={cn(
                "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300 cursor-pointer hover:border-p-dusk dark:hover:border-gray-500",
                j.isNew && "border-orange-200 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-900/10",
                exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
              )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="text-base leading-none shrink-0">{getProspectIcon(j)}</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-base truncate">{j.company}</span>
                  {j.isNew && <NewChip />}
                  <FitBadge label={j.fit} />
                  <TypeBadge type={jType} />
                </div>
                {j.url && <JobLink url={j.url} />}
              </div>
              <p className="text-base text-gray-700 dark:text-gray-200 mt-1 leading-snug">{j.role}</p>
              {j.salary && <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">{j.salary}</p>}
              {j.notes && <p className="text-sm text-stone-400 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{j.notes}</p>}
              <div className="mt-2 pt-2 border-t border-p-linen dark:border-p-dark-mid">
                <RowActions onEdit={() => onEdit(j)} onGenerate={() => onGenerate(j)} moveSections={otherSections}
                  onMove={(t) => handleMove(t, j)}
                  onDismiss={j.isNew ? () => onDismiss(j) : undefined}
                  onExportResume={onExportResume ? () => onExportResume(j) : undefined}
                  onExportCoverLetter={onExportCoverLetter ? () => onExportCoverLetter(j) : undefined} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <table className="hidden lg:table w-full text-sm">
        <thead>
          <tr className="text-xs text-p-dusk dark:text-gray-400 uppercase tracking-widest border-b border-p-linen dark:border-p-dark-mid">
            <SortableTh label="Signal" column="signal" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium w-6" />
            <SortableTh label="Company" column="company" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Role" column="role" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Fit" column="fit" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Type" column="type" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Salary" column="salary" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Notes" column="notes" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="AI" column="scoreRationale" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="max-xl:hidden text-left py-2 pr-4 font-medium" />
            <SortableTh label="Job Link" column="url" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium" />
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => {
            const jType = getProspectType(j);
            return (
              <tr key={`${j.company}${j.role}`}
                onClick={() => onDetail(j)}
                className={cn("border-b border-p-linen/60 dark:border-p-dark-mid/60 hover:bg-p-linen/40 dark:hover:bg-p-dark-mid/40 group cursor-pointer", j.isNew && "bg-orange-50/40 dark:bg-orange-900/10")}>
                <RowIcon icon={getProspectIcon(j)} />
                <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {j.company}{j.isNew && <NewChip />}
                </td>
                <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-200">{j.role}</td>
                <td className="py-2.5 pr-4">
                  {j.scoreRationale ? (
                    <div className="relative group/fit inline-block">
                      <FitBadge label={j.fit} />
                      <div className="xl:hidden absolute left-0 top-full mt-1.5 z-20 w-64 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover/fit:opacity-100 pointer-events-none transition-opacity shadow-xl leading-relaxed">
                        {j.scoreRationale}
                      </div>
                    </div>
                  ) : (
                    <FitBadge label={j.fit} />
                  )}
                </td>
                <td className="py-2.5 pr-4"><TypeBadge type={jType} /></td>
                <td className="py-2.5 pr-4 text-stone-500 dark:text-gray-400 max-w-[120px] text-xs">{j.salary || "—"}</td>
                <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[240px] text-xs leading-relaxed truncate">{j.notes}</td>
                <td className="max-xl:hidden py-2.5 pr-4 text-p-dusk dark:text-gray-500 max-w-[280px] text-xs italic leading-relaxed truncate">{j.scoreRationale}</td>
                <td className="py-2.5 pr-2"><JobLink url={j.url} /></td>
                <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <RowActions onEdit={() => onEdit(j)} onGenerate={() => onGenerate(j)} moveSections={otherSections}
                    onMove={(t) => handleMove(t, j)}
                    onDismiss={j.isNew ? () => onDismiss(j) : undefined}
                    onExportResume={onExportResume ? () => onExportResume(j) : undefined}
                    onExportCoverLetter={onExportCoverLetter ? () => onExportCoverLetter(j) : undefined} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

// ─── Passed table ─────────────────────────────────────────────────────────────

function PassedTable({ jobs, otherSections, onEdit, onMove, onGenerate, onExportResume, onExportCoverLetter, onDetail }: {
  jobs: PassedJob[];
  otherSections: { value: JobSection; label: string }[];
  onEdit: (job: PassedJob) => void;
  onMove: (target: JobSection, job: PassedJob) => void;
  onGenerate?: (job: PassedJob) => void;
  onExportResume?: (job: PassedJob) => void;
  onExportCoverLetter?: (job: PassedJob) => void;
  onDetail: (job: PassedJob) => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const sorted = useMemo(
    () => sortRows(jobs, sort, (j, col) =>
      col === "signal" ? "4" : String(j[col as keyof PassedJob] ?? "")),
    [jobs, sort]
  );

  function handleMove(target: JobSection, j: PassedJob) {
    const key = `${j.company}${j.role}`;
    const label = DISPLAY_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(target, j), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">Nothing passed yet.</p>;
  return (
    <>
      {/* Mobile/tablet cards */}
      <div className="lg:hidden space-y-2 pb-1 opacity-60">
        {sorted.map((j) => {
          const key = `${j.company}${j.role}`;
          return (
            <div key={key}
              onClick={() => onDetail(j)}
              className={cn(
                "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300 cursor-pointer hover:border-p-dusk dark:hover:border-gray-500",
                exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
              )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base leading-none shrink-0">🔴</span>
                  <span className="font-semibold text-gray-600 dark:text-gray-400 text-base truncate">{j.company}</span>
                </div>
                {j.url && <JobLink url={j.url} />}
              </div>
              <p className="text-base text-gray-700 dark:text-gray-300 mt-1 leading-snug">{j.role}</p>
              {j.salary && <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">{j.salary}</p>}
              {j.notes && <p className="text-sm text-stone-400 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{j.notes}</p>}
              <div className="mt-2 pt-2 border-t border-p-linen dark:border-p-dark-mid">
                <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)}
                  onGenerate={onGenerate ? () => onGenerate(j) : undefined}
                  onExportResume={onExportResume ? () => onExportResume(j) : undefined}
                  onExportCoverLetter={onExportCoverLetter ? () => onExportCoverLetter(j) : undefined} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <table className="hidden lg:table w-full text-sm">
        <thead>
          <tr className="text-xs text-p-dusk dark:text-gray-400 uppercase tracking-widest border-b border-p-linen dark:border-p-dark-mid">
            <SortableTh label="Signal" column="signal" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium w-6" />
            <SortableTh label="Company" column="company" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Role" column="role" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Salary" column="salary" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Reason" column="notes" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Job Link" column="url" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium" />
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => (
            <tr key={`${j.company}${j.role}`}
              onClick={() => onDetail(j)}
              className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 group opacity-60 cursor-pointer">
              <RowIcon icon="🔴" />
              <td className="py-2.5 pr-4 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{j.company}</td>
              <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{j.role}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[120px] text-xs">{j.salary || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[280px] text-xs leading-relaxed truncate">{j.notes}</td>
              <td className="py-2.5 pr-2"><JobLink url={j.url} /></td>
              <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)}
                  onGenerate={onGenerate ? () => onGenerate(j) : undefined}
                  onExportResume={onExportResume ? () => onExportResume(j) : undefined}
                  onExportCoverLetter={onExportCoverLetter ? () => onExportCoverLetter(j) : undefined} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [showPassed, setShowPassed] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [search, setSearch] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generating, setGenerating] = useState<{ company: string; role: string; url?: string } | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("");
  const [hasProfile, setHasProfile] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["applied", "prospect", "passed"]);

  const load = useCallback(async () => {
    const [jobsRes, configRes, profileRes] = await Promise.all([
      fetch(`/api/jobs`, { cache: "no-store" }),
      fetch(`/api/config`, { cache: "no-store" }),
      fetch(`/api/profile`, { cache: "no-store" }),
    ]);
    setJobs(await jobsRes.json());
    const profile = await profileRes.json() as { name?: string };
    setHasProfile(!!profile?.name);
    const config = await configRes.json();
    if (config.candidate?.name) {
      setDisplayName(config.candidate.name);
    } else {
      setShowOnboarding(true);
    }
    setShowPassed(config.preferences?.hide_passed !== true);
    if (config.ai?.model) {
      const provider = config.ai.provider ?? "anthropic";
      setModelLabel(`${provider} / ${config.ai.model}`);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function moveJob(fromSection: JobSection, company: string, role: string, toSection: JobSection) {
    await fetch(`/api/jobs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: fromSection, company, role, targetSection: toSection }),
    });
    load();
  }

  async function exportResume(company: string, role: string) {
    const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    try {
      const res = await fetch("/api/export/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `resume-${slug}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Resume export failed");
    }
  }

  async function exportCoverLetter(company: string, role: string, url?: string) {
    const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const toastId = toast.loading("Generating cover letter…");
    try {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, url, type: "cover-letter" }),
      });
      if (!genRes.ok) throw new Error("Generation failed");
      if (!genRes.body) throw new Error("No response stream");
      const reader = genRes.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      toast.loading("Exporting…", { id: toastId });
      const docxRes = await fetch("/api/export/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, company, role }),
      });
      if (!docxRes.ok) throw new Error("Export failed");
      const blob = await docxRes.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cover-letter-${slug}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Cover letter downloaded", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover letter export failed", { id: toastId });
    }
  }

  async function dismissNew(section: JobSection, company: string, role: string) {
    await fetch(`/api/jobs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, company, role, updates: { isNew: false } }),
    });
    load();
  }

  if (!jobs) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Loading…</div>
    );
  }

  // Merge all prospect-type lists with section tags
  const allProspects: TaggedProspectJob[] = [
    ...jobs.prospect.map((j) => ({ ...j, _section: "prospect" as const })),
    ...(jobs.local ?? []).map((j) => ({ ...j, _section: "local" as const })),
    ...(jobs.staffing ?? []).map((j) => ({ ...j, _section: "staffing" as const })),
  ];

  const otherSectionsFor = (from: "applied" | "prospect" | "passed") =>
    DISPLAY_SECTIONS.filter((s) => s.value !== from);

  const filterByFit = (list: TaggedProspectJob[]) =>
    fitFilter === "all" ? list : list.filter((j) => j.fit === fitFilter);

  const searchQ = search.trim().toLowerCase();
  const matchesSearch = (j: { company: string; role: string }) =>
    !searchQ || j.company.toLowerCase().includes(searchQ) || j.role.toLowerCase().includes(searchQ);

  const filteredProspects = filterByFit(allProspects).filter(matchesSearch);
  const filteredApplied = jobs.applied.filter(matchesSearch);
  const filteredPassed = jobs.passed.filter(matchesSearch);

  const totalNew = allProspects.filter((j) => j.isNew).length;
  const totalProspects = allProspects.length;

  return (
    <div className="min-h-screen bg-p-light dark:bg-p-navy">
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(config) => {
            setShowOnboarding(false);
            if (config.candidate?.name) setDisplayName(config.candidate.name);
            setShowPassed(config.preferences?.hide_passed !== true);
          }}
        />
      )}
      {generating && (
        <GenerateModal
          company={generating.company}
          role={generating.role}
          url={generating.url}
          onClose={() => setGenerating(null)}
        />
      )}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" width={32} height={32} className="shrink-0" />
              {displayName ? `${displayName} — DeckhandAI` : "DeckhandAI"}
            </h1>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
              {jobs.applied.length} applied · {totalProspects} prospects · {jobs.passed.length} passed
              {(jobs.pending ?? []).length > 0 && (
                <> · <span className="text-amber-600 dark:text-amber-400 font-medium">{jobs.pending.length} pending review</span></>
              )}
              {totalNew > 0 && (
                <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 border border-orange-200 leading-none">
                  {totalNew} new
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-start sm:items-end shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <ThemeToggle />
              <button onClick={() => setShowAdd(true)}
                className="bg-p-blue dark:bg-p-accent-inv text-white dark:text-white rounded px-4 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 transition-colors">
                + Add Job
              </button>
              <a
                href="/settings"
                className="text-sm text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1 transition-colors"
                title="Settings"
              >
                Settings
              </a>
              <button
                onClick={async () => {
                  await fetch(`/api/auth/logout`, { method: "POST" });
                  window.location.href = `/login`;
                }}
                className="text-sm text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1 transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
            <ScrapePanel onDone={load} />
            <GenericScrapePanel onDone={load} />
            <div className="flex items-center gap-3">
              <a href={`/scrape-sources`}
                className="text-xs text-p-dusk dark:text-p-accent-inv hover:text-p-blue dark:hover:opacity-80">
                Scraper coverage →
              </a>
              {modelLabel && (
                <a href="/settings/model" className="text-xs text-p-dusk dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-mono">
                  ⚙ {modelLabel}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
          <FitFilterBar active={fitFilter} onChange={setFitFilter} />
          {fitFilter !== "all" && (
            <span className="text-xs text-p-dusk dark:text-gray-400 shrink-0">
              Filtering prospects
            </span>
          )}
          <div className="ml-auto shrink-0 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-40 sm:w-52 text-sm bg-p-linen dark:bg-p-dark-mid rounded-lg pl-7 pr-6 py-1.5 text-gray-900 dark:text-white placeholder-stone-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-p-blue/30 dark:focus:ring-p-accent-inv/30 transition"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Demo mode banner */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-5 py-3 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <span className="font-semibold">Demo mode</span> — data is read-only. Clone the repo to set up your own tracker.
          </div>
        )}

        {/* Scrape review queue */}
        {(jobs.pending ?? []).length > 0 && (
          <ScrapeReviewQueue pending={jobs.pending} onUpdate={load} />
        )}

        {/* Accordion sections */}
        <Accordion
          multiple
          value={openSections}
          onValueChange={(v) => setOpenSections(v as string[])}
          className="space-y-3"
        >

          <AccordionItem value="applied"
            className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader title="Applied" count={jobs.applied.length} visibleCount={searchQ ? filteredApplied.length : undefined} />
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="overflow-x-auto">
                <AppliedTable
                  jobs={filteredApplied}
                  otherSections={otherSectionsFor("applied")}
                  onEdit={(j) => setEditing({ section: "applied", job: j })}
                  onMove={(t, j) => moveJob("applied", j.company, j.role, t)}
                  onGenerate={(j) => setGenerating({ company: j.company, role: j.role, url: j.url })}
                  onExportResume={hasProfile ? (j) => exportResume(j.company, j.role) : undefined}
                  onExportCoverLetter={hasProfile ? (j) => exportCoverLetter(j.company, j.role, j.url) : undefined}
                  onDetail={(j) => router.push(`/job?company=${encodeURIComponent(j.company)}&role=${encodeURIComponent(j.role)}&section=applied`)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="prospect"
            className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader title="Prospects" count={totalProspects}
                visibleCount={filteredProspects.length}
                newCount={totalNew} />
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="overflow-x-auto">
                <ProspectTable
                  jobs={filteredProspects}
                  onMove={moveJob}
                  onEdit={(job) => setEditing({ section: (job as TaggedProspectJob)._section ?? "prospect", job })}
                  onDismiss={(job) => dismissNew((job as TaggedProspectJob)._section ?? "prospect", job.company, job.role)}
                  onGenerate={(job) => setGenerating({ company: job.company, role: job.role, url: job.url })}
                  onExportResume={hasProfile ? (job) => exportResume(job.company, job.role) : undefined}
                  onExportCoverLetter={hasProfile ? (job) => exportCoverLetter(job.company, job.role, job.url) : undefined}
                  otherSections={otherSectionsFor("prospect")}
                  onDetail={(j) => router.push(`/job?company=${encodeURIComponent(j.company)}&role=${encodeURIComponent(j.role)}&section=${j._section}`)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {showPassed && (
            <AccordionItem value="passed"
              className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader title="Passed" count={jobs.passed.length} visibleCount={searchQ ? filteredPassed.length : undefined} />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="overflow-x-auto">
                  <PassedTable
                    jobs={filteredPassed}
                    otherSections={otherSectionsFor("passed")}
                    onEdit={(j) => setEditing({ section: "passed", job: j })}
                    onMove={(t, j) => moveJob("passed", j.company, j.role, t)}
                    onGenerate={(j) => setGenerating({ company: j.company, role: j.role, url: j.url })}
                    onExportResume={hasProfile ? (j) => exportResume(j.company, j.role) : undefined}
                    onExportCoverLetter={hasProfile ? (j) => exportCoverLetter(j.company, j.role, j.url) : undefined}
                    onDetail={(j) => router.push(`/job?company=${encodeURIComponent(j.company)}&role=${encodeURIComponent(j.role)}&section=passed`)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

        </Accordion>

        {showAdd && (
          <AddJobModal onClose={() => setShowAdd(false)}
            onAdded={() => { setShowAdd(false); load(); }} />
        )}

        {editing && (
          <JobFormModal mode="edit" section={editing.section} job={editing.job}
            originalCompany={editing.job.company} originalRole={editing.job.role}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }} />
        )}

      </div>

      <ChatDrawer onJobsChanged={load} />
    </div>
  );
}
