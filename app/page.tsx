"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// ─── Fit filter types ─────────────────────────────────────────────────────────

type FitFilter = JobFit | "all";

const FIT_OPTIONS: { value: FitFilter; label: string; active: string; inactive: string }[] = [
  { value: "all", label: "All", active: "bg-p-blue text-white border-p-blue dark:bg-p-accent-inv dark:text-white dark:border-p-accent-inv", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "strong", label: "Strong", active: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "good", label: "Good", active: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "caution", label: "Caution", active: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
  { value: "weak", label: "Weak", active: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700", inactive: "bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500" },
];

// ─── Style maps ───────────────────────────────────────────────────────────────

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

// Default sort by signal for all tables
const DEFAULT_SORT: SortState = { column: "signal", dir: "asc" };

// ─── Small shared components ──────────────────────────────────────────────────

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
      className="text-p-accent dark:text-p-accent-inv hover:opacity-80 underline text-sm">
      link
    </a>
  );
}

// ─── Move menu ────────────────────────────────────────────────────────────────

function MoveMenu({ sections, onMove }: { sections: { value: JobSection; label: string }[]; onMove: (t: JobSection) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="text-sm text-p-dusk dark:text-gray-400 hover:text-p-blue dark:hover:text-white px-1">
        Move
      </button>
      {open && (
        <div className="absolute right-0 top-5 bg-white dark:bg-p-dark-surface border border-p-linen dark:border-p-dark-mid rounded-lg shadow-lg z-10 min-w-[140px]">
          {sections.map((s) => (
            <button key={s.value} onClick={() => { onMove(s.value); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid">
              → {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RowActions({ onEdit, onGenerate, moveSections, onMove, onDismiss }: {
  onEdit: () => void;
  onGenerate?: () => void;
  moveSections: { value: JobSection; label: string }[];
  onMove: (t: JobSection) => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onDismiss && (
        <button onClick={onDismiss} title="Mark reviewed"
          className="text-sm text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 px-1 font-medium">✓</button>
      )}
      {onGenerate && (
        <button onClick={onGenerate} className="text-xs text-p-accent dark:text-p-accent-inv hover:underline px-1">Generate</button>
      )}
      <button onClick={onEdit} className="text-sm text-p-dusk dark:text-p-accent-inv hover:text-p-accent dark:hover:text-p-accent-inv px-1">Edit</button>
      <MoveMenu sections={moveSections} onMove={onMove} />
    </div>
  );
}

// ─── Section config ───────────────────────────────────────────────────────────

const ALL_SECTIONS: { value: JobSection; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "prospect", label: "Prospect" },
  { value: "local", label: "Local" },
  { value: "staffing", label: "Staffing" },
  { value: "passed", label: "Passed" },
];

type EditState = { section: JobSection; job: AppliedJob | ProspectJob | PassedJob };

// ─── Accordion section header ─────────────────────────────────────────────────

function SectionHeader({ title, count, visibleCount, newCount, fitFilter }: {
  title: string;
  count: number;
  visibleCount?: number;
  newCount?: number;
  fitFilter?: FitFilter;
}) {
  const filtered = fitFilter && fitFilter !== "all" && visibleCount !== undefined && visibleCount !== count;
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

// ─── Sections visibility dropdown ──────────────────────────────────────────────

function SectionsDropdown({ open, onToggle }: {
  open: JobSection[];
  onToggle: (section: JobSection) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setIsOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white dark:bg-p-dark-mid text-stone-500 dark:text-gray-400 border-p-linen dark:border-p-dark-mid hover:border-p-dusk dark:hover:border-gray-500">
        Sections
        <span className="text-stone-400 dark:text-gray-500">({open.length}/{ALL_SECTIONS.length})</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-7 bg-white dark:bg-p-dark-surface border border-p-linen dark:border-p-dark-mid rounded-lg shadow-lg z-20 min-w-[160px] py-1">
            {ALL_SECTIONS.map((s) => (
              <label key={s.value}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-white hover:bg-p-linen dark:hover:bg-p-dark-mid cursor-pointer">
                <input type="checkbox" checked={open.includes(s.value)}
                  onChange={() => onToggle(s.value)}
                  className="accent-p-blue dark:accent-p-accent-inv" />
                {s.label}
              </label>
            ))}
          </div>
        </>
      )}
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

// ─── Table components ─────────────────────────────────────────────────────────

function AppliedTable({ jobs, otherSections, onEdit, onMove }: {
  jobs: AppliedJob[];
  otherSections: { value: JobSection; label: string }[];
  onEdit: (job: AppliedJob) => void;
  onMove: (target: JobSection, job: AppliedJob) => void;
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
    const label = ALL_SECTIONS.find((s) => s.value === target)?.label ?? target;
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
          <div key={key} className={cn(
            "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300",
            exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          )}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base leading-none shrink-0">{getAppliedIcon(j)}</span>
                <span className="font-semibold text-gray-900 dark:text-white text-base truncate">{j.company}</span>
                <StatusBadge label={j.status} />
              </div>
              {j.url && <JobLink url={j.url} />}
            </div>
            <p className="text-base text-gray-700 dark:text-gray-200 mt-1 leading-snug">{j.role}</p>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-stone-500 dark:text-gray-400">
              {j.date && <span>{j.date}</span>}
              {j.salary && <span>{j.salary}</span>}
            </div>
            {j.notes && <p className="text-sm text-stone-400 dark:text-gray-400 mt-1.5 leading-relaxed">{j.notes}</p>}
            <div className="mt-2 pt-2 border-t border-p-linen dark:border-p-dark-mid">
              <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)} />
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
            <SortableTh label="Date" column="date" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Salary" column="salary" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Notes" column="notes" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Link" column="url" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium" />
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => (
            <tr key={`${j.company}${j.role}`} className="border-b border-p-linen/60 dark:border-p-dark-mid/60 hover:bg-p-linen/40 dark:hover:bg-p-dark-mid/40 group">
              <RowIcon icon={getAppliedIcon(j)} />
              <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{j.company}</td>
              <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-200">{j.role}</td>
              <td className="py-2.5 pr-4"><StatusBadge label={j.status} /></td>
              <td className="py-2.5 pr-4 text-stone-500 dark:text-gray-400 whitespace-nowrap">{j.date || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-500 dark:text-gray-400 max-w-[120px] text-xs">{j.salary || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[220px] text-xs leading-relaxed">{j.notes}</td>
              <td className="py-2.5 pr-2"><JobLink url={j.url} /></td>
              <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ProspectTable({ jobs, section, onMove, onEdit, onDismiss, onGenerate, otherSections }: {
  jobs: ProspectJob[];
  section: JobSection;
  onMove: (from: JobSection, company: string, role: string, to: JobSection) => void;
  onEdit: (job: ProspectJob) => void;
  onDismiss: (job: ProspectJob) => void;
  onGenerate: (job: ProspectJob) => void;
  otherSections: { value: JobSection; label: string }[];
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const sorted = useMemo(
    () => sortRows(jobs, sort, (j, col) =>
      col === "signal" ? iconSortKey(getProspectIcon(j)) : String(j[col as keyof ProspectJob] ?? "")),
    [jobs, sort]
  );

  function handleMove(target: JobSection, j: ProspectJob) {
    const key = `${j.company}${j.role}`;
    const label = ALL_SECTIONS.find((s) => s.value === target)?.label ?? target;
    setExitingKey(key);
    toast.success(`Moved to ${label}`);
    setTimeout(() => onMove(section, j.company, j.role, target), 300);
  }

  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-4 px-1">No roles match the current filter.</p>;
  return (
    <>
      {/* Mobile/tablet cards */}
      <div className="lg:hidden space-y-2 pb-1">
        {sorted.map((j) => {
          const key = `${j.company}${j.role}`;
          return (
          <div key={key}
            className={cn(
              "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300",
              j.isNew && "border-orange-200 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-900/10",
              exitingKey === key && "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            )}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base leading-none shrink-0">{getProspectIcon(j)}</span>
                <span className="font-semibold text-gray-900 dark:text-white text-base truncate">{j.company}</span>
                {j.isNew && <NewChip />}
                <FitBadge label={j.fit} />
              </div>
              {j.url && <JobLink url={j.url} />}
            </div>
            <p className="text-base text-gray-700 dark:text-gray-200 mt-1 leading-snug">{j.role}</p>
            {j.salary && <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">{j.salary}</p>}
            {j.notes && <p className="text-sm text-stone-400 dark:text-gray-400 mt-1.5 leading-relaxed">{j.notes}</p>}
            <div className="mt-2 pt-2 border-t border-p-linen dark:border-p-dark-mid">
              <RowActions onEdit={() => onEdit(j)} onGenerate={() => onGenerate(j)} moveSections={otherSections}
                onMove={(t) => handleMove(t, j)}
                onDismiss={j.isNew ? () => onDismiss(j) : undefined} />
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
            <SortableTh label="Salary" column="salary" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Notes" column="notes" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
            <SortableTh label="Link" column="url" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium" />
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => (
            <tr key={`${j.company}${j.role}`}
              className={cn("border-b border-p-linen/60 dark:border-p-dark-mid/60 hover:bg-p-linen/40 dark:hover:bg-p-dark-mid/40 group", j.isNew && "bg-orange-50/40 dark:bg-orange-900/10")}>
              <RowIcon icon={getProspectIcon(j)} />
              <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {j.company}{j.isNew && <NewChip />}
              </td>
              <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-200">{j.role}</td>
              <td className="py-2.5 pr-4"><FitBadge label={j.fit} /></td>
              <td className="py-2.5 pr-4 text-stone-500 dark:text-gray-400 max-w-[120px] text-xs">{j.salary || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[240px] text-xs leading-relaxed">{j.notes}</td>
              <td className="py-2.5 pr-2"><JobLink url={j.url} /></td>
              <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <RowActions onEdit={() => onEdit(j)} onGenerate={() => onGenerate(j)} moveSections={otherSections}
                  onMove={(t) => handleMove(t, j)}
                  onDismiss={j.isNew ? () => onDismiss(j) : undefined} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PassedTable({ jobs, otherSections, onEdit, onMove }: {
  jobs: PassedJob[];
  otherSections: { value: JobSection; label: string }[];
  onEdit: (job: PassedJob) => void;
  onMove: (target: JobSection, job: PassedJob) => void;
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
    const label = ALL_SECTIONS.find((s) => s.value === target)?.label ?? target;
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
          <div key={key} className={cn(
            "border border-p-linen dark:border-p-dark-mid rounded-lg p-3 bg-white dark:bg-p-dark-surface transition-all duration-300",
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
            {j.notes && <p className="text-sm text-stone-400 dark:text-gray-400 mt-1.5 leading-relaxed">{j.notes}</p>}
            <div className="mt-2 pt-2 border-t border-p-linen dark:border-p-dark-mid">
              <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)} />
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
            <SortableTh label="Link" column="url" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} className="text-left py-2 pr-2 font-medium" />
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((j) => (
            <tr key={`${j.company}${j.role}`} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 group opacity-60">
              <RowIcon icon="🔴" />
              <td className="py-2.5 pr-4 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{j.company}</td>
              <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{j.role}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[120px] text-xs">{j.salary || "—"}</td>
              <td className="py-2.5 pr-4 text-stone-400 dark:text-gray-400 max-w-[280px] text-xs leading-relaxed">{j.notes}</td>
              <td className="py-2.5 pr-2"><JobLink url={j.url} /></td>
              <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <RowActions onEdit={() => onEdit(j)} moveSections={otherSections} onMove={(t) => handleMove(t, j)} />
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
  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [showLocal, setShowLocal] = useState(true);
  const [showStaffing, setShowStaffing] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generating, setGenerating] = useState<{ company: string; role: string; url?: string } | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("");
  const [openSections, setOpenSections] = useState<JobSection[]>(
    ALL_SECTIONS.map((s) => s.value)
  );

  function toggleSection(section: JobSection) {
    setOpenSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  }

  const load = useCallback(async () => {
    const [jobsRes, configRes] = await Promise.all([
      fetch(`/api/jobs`),
      fetch(`/api/config`),
    ]);
    setJobs(await jobsRes.json());
    const config = await configRes.json();
    if (config.candidate?.name) {
      setDisplayName(config.candidate.name);
    } else {
      setShowOnboarding(true);
    }
    setShowLocal(config.preferences?.locations?.hybrid !== false);
    setShowStaffing(config.preferences?.open_to_contract !== false);
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

  const visibleSections = ALL_SECTIONS.filter((s) => {
    if (s.value === "local" && !showLocal) return false;
    if (s.value === "staffing" && !showStaffing) return false;
    return true;
  });

  const otherSections = (from: JobSection) => visibleSections.filter((s) => s.value !== from);

  const filterByFit = (list: ProspectJob[]) =>
    fitFilter === "all" ? list : list.filter((j) => j.fit === fitFilter);

  const filteredProspect = filterByFit(jobs.prospect);
  const filteredLocal = filterByFit(jobs.local);
  const filteredStaffing = filterByFit(jobs.staffing);

  const totalNew =
    jobs.prospect.filter((j) => j.isNew).length +
    (showLocal ? jobs.local.filter((j) => j.isNew).length : 0) +
    (showStaffing ? jobs.staffing.filter((j) => j.isNew).length : 0);

  return (
    <div className="min-h-screen bg-p-light dark:bg-p-navy">
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(config) => {
            setShowOnboarding(false);
            if (config.candidate?.name) setDisplayName(config.candidate.name);
            setShowLocal(config.preferences?.locations?.hybrid !== false);
            setShowStaffing(config.preferences?.open_to_contract !== false);
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {displayName ? `${displayName} — DeckhandAI Job Tracker` : "DeckhandAI Job Tracker"}
            </h1>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
              {jobs.applied.length} applied ·{" "}
              {jobs.prospect.length + (showLocal ? jobs.local.length : 0)} prospects{showStaffing ? ` · ${jobs.staffing.length} staffing` : ""} ·{" "}
              {jobs.passed.length} passed
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
          <div className="w-px h-4 bg-p-linen dark:bg-p-dark-mid shrink-0" />
          <SectionsDropdown open={openSections} onToggle={toggleSection} />
          {fitFilter !== "all" && (
            <span className="text-xs text-p-dusk dark:text-gray-400 ml-auto shrink-0">
              Filtering prospects, local &amp; staffing
            </span>
          )}
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
          onValueChange={(v) => setOpenSections(v as JobSection[])}
          className="space-y-3"
        >

          <AccordionItem value="applied"
            className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader title="Applied" count={jobs.applied.length} />
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="overflow-x-auto">
                <AppliedTable jobs={jobs.applied} otherSections={otherSections("applied")}
                  onEdit={(j) => setEditing({ section: "applied", job: j })}
                  onMove={(t, j) => moveJob("applied", j.company, j.role, t)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="prospect"
            className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader title="Prospects — Remote" count={jobs.prospect.length}
                visibleCount={filteredProspect.length}
                newCount={jobs.prospect.filter((j) => j.isNew).length}
                fitFilter={fitFilter} />
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="overflow-x-auto">
                <ProspectTable jobs={filteredProspect} section="prospect" onMove={moveJob}
                  onEdit={(job) => setEditing({ section: "prospect", job })}
                  onDismiss={(job) => dismissNew("prospect", job.company, job.role)}
                  onGenerate={(job) => setGenerating({ company: job.company, role: job.role, url: job.url })}
                  otherSections={otherSections("prospect")} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {showLocal && (
            <AccordionItem value="local"
              className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader title="Local / Hybrid" count={jobs.local.length}
                  visibleCount={filteredLocal.length}
                  newCount={jobs.local.filter((j) => j.isNew).length}
                  fitFilter={fitFilter} />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="overflow-x-auto">
                  <ProspectTable jobs={filteredLocal} section="local" onMove={moveJob}
                    onEdit={(job) => setEditing({ section: "local", job })}
                    onDismiss={(job) => dismissNew("local", job.company, job.role)}
                    onGenerate={(job) => setGenerating({ company: job.company, role: job.role, url: job.url })}
                    otherSections={otherSections("local")} />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {showStaffing && (
            <AccordionItem value="staffing"
              className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader title="Staffing / Contract" count={jobs.staffing.length}
                  visibleCount={filteredStaffing.length}
                  newCount={jobs.staffing.filter((j) => j.isNew).length}
                  fitFilter={fitFilter} />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="overflow-x-auto">
                  <ProspectTable jobs={filteredStaffing} section="staffing" onMove={moveJob}
                    onEdit={(job) => setEditing({ section: "staffing", job })}
                    onDismiss={(job) => dismissNew("staffing", job.company, job.role)}
                    onGenerate={(job) => setGenerating({ company: job.company, role: job.role, url: job.url })}
                    otherSections={otherSections("staffing")} />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="passed"
            className="bg-white dark:bg-p-dark-surface rounded-xl border border-p-linen dark:border-p-dark-mid shadow-sm px-4 overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader title="Passed / Skipped" count={jobs.passed.length} />
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="overflow-x-auto">
                <PassedTable jobs={jobs.passed} otherSections={otherSections("passed")}
                  onEdit={(j) => setEditing({ section: "passed", job: j })}
                  onMove={(t, j) => moveJob("passed", j.company, j.role, t)} />
              </div>
            </AccordionContent>
          </AccordionItem>

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
    </div>
  );
}
