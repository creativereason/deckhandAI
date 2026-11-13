-- Jobs are never physically deleted. Removing a job sets deleted_at, the row
-- stays in the table, and every read filters it out. This keeps an audit trail
-- and makes an accidental or bot-driven removal recoverable.
alter table public.jobs add column deleted_at timestamptz;

-- The app and scripts always read "live" rows, so index just those.
create index jobs_live_section_position_idx on public.jobs (section, position)
  where deleted_at is null;

-- Enforce it in the database too: the server key can no longer DELETE from jobs,
-- so a bug or a compromised bot key cannot erase rows. Revert deliberately by
-- granting DELETE back to service_role if you ever need a hard purge.
revoke delete on public.jobs from service_role;
