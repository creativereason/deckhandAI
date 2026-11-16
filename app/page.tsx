"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JobFormModal from "@/components/JobFormModal";
import OnboardingWizard from "@/components/OnboardingWizard";
import InboxView from "@/components/InboxView";
import TodayView from "@/components/TodayView";
import GenerateModal from "@/components/GenerateModal";
import AppShell from "@/components/shell/AppShell";
import { JOBS_CHANGED_EVENT, useAssistant } from "@/components/shell/assistant-context";
import { useBoardView } from "@/components/use-board-view";
import AppliedStatusFilter from "@/components/AppliedStatusFilter";
import PipelineBoard from "@/components/PipelineBoard";
import { BoardToolbar, FitFilterBar, SectionVisibilityBar, type FitFilter, type ToggleableSection } from "@/components/board/BoardToolbar";
import { JobList, type RowHandlers } from "@/components/board/JobList";
import { appliedRow, passedRow, prospectRow, type BoardRow } from "@/components/board/board-row";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { exportCoverLetter, exportResume } from "@/lib/job-export-client";
import type { AppliedJob, JobIdentity, JobsData, JobSection, JobStatus, JobType, PassedJob, ProspectJob } from "@/lib/jobs";
import { jobDetailHref } from "@/lib/job-detail";
import { parseBoardLayout, type BoardLayout } from "@/lib/board-layout";
import { buildPipeline, moveAction, type MoveTarget, type PipelineCard } from "@/lib/pipeline";
import { applyMove } from "@/lib/pipeline-client";
import { DEFAULT_HIDDEN_STATUSES, filterByStatus, parseHiddenStatuses, statusCounts, toggleStatus } from "@/lib/applied-status-filter";

type EditState = { section: JobSection; job: AppliedJob | ProspectJob | PassedJob; jobType?: JobType };
const BOARD_FILTERS_STORAGE_KEY = "board-filters";
const MOVE_LABELS: Record<"applied" | "prospect" | "passed", string> = { applied: "Applied", prospect: "Prospects", passed: "Passed" };
const ALL_SECTIONS: ToggleableSection[] = ["applied", "prospect", "passed"];

function useBoardFilters() {
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [layout, setLayout] = useState<BoardLayout>("list");
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<JobStatus>>(new Set(DEFAULT_HIDDEN_STATUSES));
  const [visibleSections, setVisibleSections] = useState<Set<ToggleableSection>>(new Set(ALL_SECTIONS));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOARD_FILTERS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { fitFilter?: FitFilter; visibleSections?: ToggleableSection[]; hiddenStatuses?: unknown; layout?: unknown };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (saved.fitFilter) setFitFilter(saved.fitFilter);
        if (saved.visibleSections) setVisibleSections(new Set(saved.visibleSections));
        setLayout(parseBoardLayout(saved.layout));
        if (saved.hiddenStatuses !== undefined) setHiddenStatuses(new Set(parseHiddenStatuses(saved.hiddenStatuses)));
      }
    } catch {
      // malformed or blocked storage: the defaults are fine
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(BOARD_FILTERS_STORAGE_KEY, JSON.stringify({ fitFilter, visibleSections: Array.from(visibleSections), hiddenStatuses: Array.from(hiddenStatuses), layout }));
    } catch {
      // not remembered, still works
    }
  }, [hydrated, fitFilter, visibleSections, hiddenStatuses, layout]);

  const toggleSection = (s: ToggleableSection) => setVisibleSections((cur) => { const next = new Set(cur); if (next.has(s)) next.delete(s); else next.add(s); return next; });
  return { fitFilter, setFitFilter, layout, setLayout, hiddenStatuses, setHiddenStatuses, visibleSections, toggleSection };
}

function BoardContent() {
  const router = useRouter();
  const assistant = useAssistant();
  const [view, setView] = useBoardView();
  const filters = useBoardFilters();
  const { fitFilter, layout, hiddenStatuses, visibleSections } = filters;
  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [showPassed, setShowPassed] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generating, setGenerating] = useState<{ company: string; role: string; url?: string } | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [jobsRes, configRes, profileRes] = await Promise.all([
        fetch(`/api/jobs`, { cache: "no-store" }),
        fetch(`/api/config`, { cache: "no-store" }),
        fetch(`/api/profile`, { cache: "no-store" }),
      ]);
      setJobs(await jobsRes.json());
      const profile = await profileRes.json() as { name?: string };
      setHasProfile(!!profile?.name);
      const config = await configRes.json();
      if (config.candidate?.name) setDisplayName(config.candidate.name);
      else setShowOnboarding(true);
      setShowPassed(config.preferences?.hide_passed !== true);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener(JOBS_CHANGED_EVENT, load);
    return () => window.removeEventListener(JOBS_CHANGED_EVENT, load);
  }, [load]);

  async function moveJob(fromSection: JobSection, job: JobIdentity, toSection: JobSection) {
    await fetch(`/api/jobs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: job.id, section: fromSection, company: job.company, role: job.role, targetSection: toSection }),
    });
    toast.success(`Moved to ${MOVE_LABELS[toSection as keyof typeof MOVE_LABELS] ?? toSection}`);
    load();
  }

  async function moveCard(card: PipelineCard, to: MoveTarget) {
    const result = await applyMove(card, moveAction(card, to));
    if (!result.ok) toast.error(`Move failed: ${result.message}`);
    load();
  }

  async function dismissNew(section: JobSection, job: JobIdentity) {
    await fetch(`/api/jobs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: job.id, section, company: job.company, role: job.role, updates: { isNew: false } }),
    });
    load();
  }

  if (!jobs) return <LoadingState label={loadError ? "Could not reach the server, retrying" : "Loading your board"} />;

  const taggedProspects = [
    ...jobs.prospect.map((j) => ({ ...j, _section: "prospect" as const })),
    ...(jobs.local ?? []).map((j) => ({ ...j, _section: "local" as const })),
    ...(jobs.staffing ?? []).map((j) => ({ ...j, _section: "staffing" as const })),
  ];
  const q = search.trim().toLowerCase();
  const matches = (j: { company: string; role: string }) => !q || j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q);
  const prospects = (fitFilter === "all" ? taggedProspects : taggedProspects.filter((j) => j.fit === fitFilter)).filter(matches);
  const appliedList = filterByStatus(jobs.applied, hiddenStatuses).filter(matches);
  const passedList = jobs.passed.filter(matches);
  const totalNew = taggedProspects.filter((j) => j.isNew).length;
  const pendingCount = (jobs.pending ?? []).length;

  const rowHandlers: RowHandlers = (row: BoardRow) => {
    const moveTargets = (Object.keys(MOVE_LABELS) as (keyof typeof MOVE_LABELS)[])
      .filter((s) => s !== (row.section === "applied" || row.section === "passed" ? row.section : "prospect"))
      .map((value) => ({ value: value as JobSection, label: MOVE_LABELS[value] }));
    const ctx = { company: row.company, role: row.role, url: row.url || undefined };
    return {
      onEdit: () => setEditing({ section: row.section, job: row.job }),
      onAsk: () => assistant.ask(`Tell me about the ${row.role} role at ${row.company}: fit, red flags, and what to do next.`, { send: true }),
      onGenerate: () => setGenerating(ctx),
      onExportResume: hasProfile ? () => exportResume(row.company, row.role) : undefined,
      onExportCoverLetter: hasProfile ? () => exportCoverLetter(row.company, row.role, row.url) : undefined,
      onDismissNew: row.isNew ? () => dismissNew(row.section, row.job) : undefined,
      moveTargets,
      onMove: (target) => moveJob(row.section, row.job, target),
    };
  };

  const title = view === "today" ? "Today" : view === "inbox" ? "Inbox" : "Board";
  const description =
    view === "today" ? (displayName ? `${displayName}'s job search` : "Your job search at a glance")
    : view === "inbox" ? "New jobs from scrapes and agents, waiting for your call."
    : `${jobs.applied.length} applied · ${taggedProspects.length} prospects · ${jobs.passed.length} passed${pendingCount ? ` · ${pendingCount} pending review` : ""}${totalNew ? ` · ${totalNew} new` : ""}`;

  const pipelineColumns = buildPipeline({ prospects: prospects, applied: jobs.applied.filter(matches) }, hiddenStatuses);
  const sectionToggles = visibleSections;

  return (
    <>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(config) => {
            setShowOnboarding(false);
            if (config.candidate?.name) setDisplayName(config.candidate.name);
            setShowPassed(config.preferences?.hide_passed !== true);
          }}
        />
      )}
      {generating && <GenerateModal company={generating.company} role={generating.role} url={generating.url} onClose={() => setGenerating(null)} />}

      <PageHeader title={title} description={description} />

      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
        <p role="note" className="mb-4 rounded-lg bg-primary-subtle p-3 text-sm text-primary-subtle-foreground">
          <strong className="font-semibold">Demo mode.</strong> Try adding, editing, and evaluating jobs. This is a shared board that resets nightly. Clone the repo to set up your own tracker.
        </p>
      )}

      {view === "today" && <TodayView jobs={jobs} onOpenInbox={() => setView("inbox")} />}
      {view === "inbox" && <InboxView pending={jobs.pending ?? []} onUpdate={load} onBackToBoard={() => setView("board")} />}

      {view === "board" && (
        <div className="flex flex-col gap-4">
          <BoardToolbar layout={layout} onLayout={filters.setLayout} search={search} onSearch={setSearch} onAdd={() => setAdding(true)} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {layout === "list" && <SectionVisibilityBar visible={sectionToggles} onToggle={filters.toggleSection} />}
            <FitFilterBar active={fitFilter} onChange={filters.setFitFilter} />
            <AppliedStatusFilter counts={statusCounts(jobs.applied)} hidden={hiddenStatuses} onToggle={(status) => filters.setHiddenStatuses((cur) => toggleStatus(cur, status))} />
          </div>

          {layout === "pipeline" && (
            <PipelineBoard
              columns={pipelineColumns}
              passedCount={jobs.passed.length}
              onMove={moveCard}
              onOpen={(card) => router.push(jobDetailHref({ id: card.id, company: card.company, role: card.role, section: card.section }))}
            />
          )}

          {layout === "list" && (
            <div className="flex flex-col gap-4">
              {visibleSections.has("applied") && (
                <JobList kind="applied" title="Applied" rows={appliedList.map(appliedRow)} total={jobs.applied.length} handlers={rowHandlers} emptyTitle="No applications match" />
              )}
              {visibleSections.has("prospect") && (
                <JobList kind="prospect" title="Prospects" rows={prospects.map((j) => prospectRow(j, j._section))} total={taggedProspects.length} newCount={totalNew} handlers={rowHandlers} emptyTitle="No roles match the current filter" />
              )}
              {showPassed && visibleSections.has("passed") && (
                <JobList kind="passed" title="Passed" rows={passedList.map(passedRow)} total={jobs.passed.length} handlers={rowHandlers} emptyTitle="Nothing passed yet" defaultOpen={false} />
              )}
            </div>
          )}
        </div>
      )}

      {adding && <JobFormModal mode="add" section="prospect" onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {editing && (
        <JobFormModal mode="edit" section={editing.section} job={editing.job} originalCompany={editing.job.company} originalRole={editing.job.role} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}

export default function Home() {
  return <AppShell><BoardContent /></AppShell>;
}
