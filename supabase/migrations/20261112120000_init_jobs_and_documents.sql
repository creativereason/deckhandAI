-- deckhandAI: replace data/jobs.json and data/{config,profile,scrape-targets}.json
-- with Postgres tables. Single-tenant: the app talks to Supabase only from the
-- server using the service-role key, so RLS is enabled with NO policies. That
-- denies every request made with the anon or authenticated keys.

-- One row per job. The six JSON arrays (applied, prospect, local, staffing,
-- passed, pending) become the `section` column, so moving a job between
-- sections is a single UPDATE rather than a splice across arrays.
create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  section         text not null
                    check (section in ('applied', 'prospect', 'local', 'staffing', 'passed', 'pending')),
  company         text not null,
  role            text not null,
  url             text not null default '',
  salary          text not null default '',
  notes           text not null default '',
  ai_summary      text,
  score_rationale text,

  -- Nullable: which of these apply varies by section (and applied jobs in the
  -- sample data carry a fit too).
  status          text
                    check (status in ('applied', 'screening', 'interview', 'offer', 'declined')),
  fit             text
                    check (fit in ('strong', 'good', 'caution', 'weak')),
  type            text
                    check (type in ('remote', 'hybrid', 'local', 'contract')),
  applied_date    date,
  is_new          boolean not null default false,
  is_ghost        boolean not null default false,
  scrape_group    text
                    check (scrape_group in ('remote', 'local')),
  scrape_date     date,

  -- jobs.json arrays are newest-first (new jobs are unshifted). The importer
  -- sets position from the array index; ORDER BY section, position reproduces
  -- the original order. New rows should take min(position) - 1 in their section.
  position        integer not null default 0,

  -- Who created the row: 'manual', 'scraper', 'import', and later per-agent names.
  source          text not null default 'manual',

  -- Deterministic key written only by the importer ("section::index::company::role")
  -- so re-running the migration upserts instead of duplicating.
  legacy_key      text unique,

  -- Overflow for any field not modelled above, so the import never drops data.
  extra           jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index jobs_section_position_idx on public.jobs (section, position);
create index jobs_company_role_idx on public.jobs (company, role);
-- Dedup checks ("is this URL already tracked?") skip rows with no URL.
create index jobs_url_idx on public.jobs (url) where url <> '';

-- config, profile and scrape-targets are each read and written as a whole
-- document, so a key/value table is the right shape.
create table public.documents (
  name        text primary key
                check (name in ('config', 'profile', 'scrape-targets')),
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Defence in depth: RLS with no policies already denies anon/authenticated,
-- and revoking the table grants means they cannot even attempt access.
-- service_role bypasses RLS and keeps its privileges.
alter table public.jobs enable row level security;
alter table public.documents enable row level security;

revoke all on public.jobs from anon, authenticated;
revoke all on public.documents from anon, authenticated;
