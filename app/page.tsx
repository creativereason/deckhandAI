"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JobFormModal from "@/components/JobFormModal";
import OnboardingWizard from "@/components/OnboardingWizard";
import ScrapeReviewQueue from "@/components/ScrapeReviewQueue";
import GenerateModal from "@/components/GenerateModal";
import {
  JobsData,
  AppliedJob,
  ProspectJob,
  PassedJob,
  JobSection,
  JobFit,
  JobType,
  resolveJobType,
  jobKey,
} from "@/lib/jobs";
import { nextSort, sortRows, type SortState } from "@/lib/table-sort";
import { getAppliedIcon, getProspectIcon, iconSortKey } from "@/lib/job-signal";
import { SignalIcon } from "@/components/SignalIcon";
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
type ToggleableSection = "applied" | "prospect" | "passed";

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

const SECTION_VISIBILITY_OPTIONS: { value: ToggleableSection; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "prospect", label: "Prospects" },
  { value: "passed", label: "Passed" },
];

const BOARD_FILTERS_STORAGE_KEY = "board-filters";

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

function SortMenu({ options, sort, onChange }: {
  options: { value: string; label: string }[];
  sort: SortState;
  onChange: (column: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-p-dusk dark:text-gray-400 uppercase tracking-widest font-medium">Sort</label>
      <select
        value={sort.column}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-p-linen dark:bg-p-dark-mid rounded-lg pl-2 pr-6 py-1 text-gray-700 dark:text-gray-200 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(sort.column)}
        aria-label={sort.dir === "asc" ? "Sort ascending" : "Sort descending"}
        className="text-stone-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        {sort.dir === "asc" ? "↑" : "↓"}
      </button>
    </div>
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

function SectionVisibilityBar({ visible, onToggle }: {
  visible: Set<ToggleableSection>;
  onToggle: (section: ToggleableSection) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-p-dusk dark:text-p-accent-inv font-medium mr-1 uppercase tracking-widest">Show:</span>
      {SECTION_VISIBILITY_OPTIONS.map((opt) => {
        const active = visible.has(opt.value);
        return (
          <button key={opt.value} onClick={() => onToggle(opt.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all",
              active
                ? "bg-p-blue text-white border-p-blue dark:bg-p-accent-inv dark:text-white dark:border-p-accent-inv"
                : "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500"
            )}>
            {opt.label}
          </button>
        );
      })}
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
    const key = jobKey(j.company, j.role);
    const label = DISPLAY_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(target, j), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">No applications yet.</p>;
  return (
    <div className="space-y-2 pb-1">
      <div className="flex justify-end pb-1">
        <SortMenu
          sort={sort}
          onChange={(c) => setSort((s) => nextSort(s, c))}
          options={[
            { value: "signal", label: "Signal" },
            { value: "company", label: "Company" },
            { value: "role", label: "Role" },
            { value: "status", label: "Status" },
            { value: "type", label: "Type" },
            { value: "date", label: "Date" },
            { value: "salary", label: "Salary" },
          ]}
        />
      </div>
      {sorted.map((j) => {
        const key = jobKey(j.company, j.role);
        return (
          <div key={key}
            onClick={() => onDetail(j)}
            className={cn(
              "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300 cursor-pointer hover:border-p-dusk dark:hover:border-gray-500",
              exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            )}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="leading-none shrink-0 flex items-center"><SignalIcon icon={getAppliedIcon(j)} size={16} /></span>
                <span className="font-semibold text-gray-900 dark:text-white text-base truncate">{j.company}</span>
                <StatusBadge label={j.status} />
                <TypeBadge type={resolveJobType("applied", j)} />
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
    const key = jobKey(j.company, j.role);
    const label = DISPLAY_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(j._section, j.company, j.role, target), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">No roles match the current filter.</p>;
  return (
    <div className="space-y-2 pb-1">
      <div className="flex justify-end pb-1">
        <SortMenu
          sort={sort}
          onChange={(c) => setSort((s) => nextSort(s, c))}
          options={[
            { value: "signal", label: "Signal" },
            { value: "company", label: "Company" },
            { value: "role", label: "Role" },
            { value: "fit", label: "Fit" },
            { value: "type", label: "Type" },
            { value: "salary", label: "Salary" },
          ]}
        />
      </div>
      {sorted.map((j) => {
        const key = jobKey(j.company, j.role);
        const jType = resolveJobType(j._section, j);
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
                <span className="leading-none shrink-0 flex items-center"><SignalIcon icon={getProspectIcon(j)} size={16} /></span>
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
            {j.scoreRationale && <p className="text-xs text-p-dusk dark:text-gray-500 italic mt-1.5 leading-relaxed">{j.scoreRationale}</p>}
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
    const key = jobKey(j.company, j.role);
    const label = DISPLAY_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(target, j), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">Nothing passed yet.</p>;
  return (
    <div className="space-y-2 pb-1 opacity-60">
      <div className="flex justify-end pb-1">
        <SortMenu
          sort={sort}
          onChange={(c) => setSort((s) => nextSort(s, c))}
          options={[
            { value: "company", label: "Company" },
            { value: "role", label: "Role" },
            { value: "salary", label: "Salary" },
            { value: "notes", label: "Reason" },
          ]}
        />
      </div>
      {sorted.map((j) => {
        const key = jobKey(j.company, j.role);
        return (
          <div key={key}
            onClick={() => onDetail(j)}
            className={cn(
              "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300 cursor-pointer hover:border-p-dusk dark:hover:border-gray-500",
              exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            )}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="leading-none shrink-0 flex items-center"><SignalIcon icon="🔴" size={16} /></span>
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
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [showPassed, setShowPassed] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [search, setSearch] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generating, setGenerating] = useState<{ company: string; role: string; url?: string } | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("");
  const [hasProfile, setHasProfile] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["applied", "prospect", "passed"]);
  const [visibleSections, setVisibleSections] = useState<Set<ToggleableSection>>(
    new Set(["applied", "prospect", "passed"])
  );

  function toggleSectionVisibility(section: ToggleableSection) {
    setVisibleSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  const [filtersHydrated, setFiltersHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(BOARD_FILTERS_STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { fitFilter?: FitFilter; visibleSections?: ToggleableSection[] };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (saved.fitFilter) setFitFilter(saved.fitFilter);
        if (saved.visibleSections) setVisibleSections(new Set(saved.visibleSections));
      } catch {
        // ignore malformed storage from a prior schema
      }
    }
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;
    localStorage.setItem(
      BOARD_FILTERS_STORAGE_KEY,
      JSON.stringify({ fitFilter, visibleSections: Array.from(visibleSections) })
    );
  }, [filtersHydrated, fitFilter, visibleSections]);

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
              <img src="/logo.svg" alt="" width={64} height={64} className="shrink-0" />
              DeckhandAI
            </h1>
            {displayName && (
              <p className="text-xs text-stone-400 dark:text-gray-500 mt-0.5">{displayName}&apos;s Job board</p>
            )}
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

        {/* Board (2/3) + Deckhand assistant (1/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

          {/* Deckhand assistant — stacked on top on mobile, right rail (sticky) from md up */}
          <div className="order-1 md:order-2 md:col-span-1 md:sticky md:top-4 min-w-0">
            <ChatDrawer onJobsChanged={load} />
          </div>

          {/* Board */}
          <div className="order-2 md:order-1 md:col-span-2 space-y-4">

            {/* Filter bar */}
            <div className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
              <SectionVisibilityBar visible={visibleSections} onToggle={toggleSectionVisibility} />
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

          {visibleSections.has("applied") && (
            <AccordionItem value="applied"
              className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader title="Applied" count={jobs.applied.length} visibleCount={searchQ ? filteredApplied.length : undefined} />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
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
              </AccordionContent>
            </AccordionItem>
          )}

          {visibleSections.has("prospect") && (
            <AccordionItem value="prospect"
              className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader title="Prospects" count={totalProspects}
                  visibleCount={filteredProspects.length}
                  newCount={totalNew} />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="mb-3">
                  <FitFilterBar active={fitFilter} onChange={setFitFilter} />
                </div>
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
              </AccordionContent>
            </AccordionItem>
          )}

          {showPassed && visibleSections.has("passed") && (
            <AccordionItem value="passed"
              className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader title="Passed" count={jobs.passed.length} visibleCount={searchQ ? filteredPassed.length : undefined} />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
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
              </AccordionContent>
            </AccordionItem>
          )}

        </Accordion>

          </div>
        </div>

        {/* Footer */}
        <footer className="pt-4 pb-2 text-center text-xs text-stone-400 dark:text-gray-500">
          DeckhandAI originally created by{" "}
          <a
            href="https://creativereason.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-p-dusk dark:text-gray-400 hover:text-p-blue dark:hover:text-white underline transition-colors"
          >
            creativereason
          </a>
          {" · "}
          Fork on {" "}
          <a
            href="https://github.com/creativereason/deckhandAI"
            target="_blank"
            rel="noopener noreferrer"
            className="text-p-dusk dark:text-gray-400 hover:text-p-blue dark:hover:text-white underline transition-colors"
          >
            GitHub
          </a>
          {" · "}
          <a
            href="https://github.com/creativereason/deckhandAI/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-p-dusk dark:text-gray-400 hover:text-p-blue dark:hover:text-white underline transition-colors"
          >
            MIT License
          </a>
        </footer>

        {editing && (
          <JobFormModal mode="edit" section={editing.section} job={editing.job}
            originalCompany={editing.job.company} originalRole={editing.job.role}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }} />
        )}

      </div>
    </div>
  );
}
