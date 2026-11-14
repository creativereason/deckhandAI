-- Slice 20: an append-only log of every change to a job: who, what, when, and the
-- row before and after. Written by a trigger on jobs, so the event and the change
-- commit together or not at all, for every writer (app, scripts, agents).

-- The writer names itself here. The trigger reads it, then clears it, so an update
-- that does not name an actor is recorded as 'unknown' instead of inheriting the last one.
alter table public.jobs add column last_actor text;

create table public.job_events (
  id          uuid primary key default gen_random_uuid(),
  -- Deferred: the trigger runs before the jobs row exists on INSERT.
  job_id      uuid not null references public.jobs (id) deferrable initially deferred,
  actor       text not null,
  action      text not null check (action in ('create', 'edit', 'move', 'archive', 'restore')),
  before      jsonb,
  after       jsonb not null,
  created_at  timestamptz not null default now()
);

-- "What happened to this job" is the only lookup the app does.
create index job_events_job_id_created_at_idx on public.job_events (job_id, created_at desc);

-- Same stance as jobs: RLS on, no policies, server key only.
alter table public.job_events enable row level security;

-- Append-only: nobody can edit or erase history, including the server key.
revoke update, delete, truncate on public.job_events from anon, authenticated, service_role;

create function public.record_job_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_name text := new.last_actor;
  before_row jsonb;
  after_row  jsonb := to_jsonb(new) - 'last_actor' - 'updated_at';
  kind       text;
begin
  -- An upsert that turns into an update runs the INSERT trigger first. The row already
  -- exists, so skip: the UPDATE that follows records the edit, not a false "create".
  if tg_op = 'INSERT' and exists (select 1 from public.jobs where id = new.id) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    kind := 'create';
    actor_name := coalesce(actor_name, new.source);
  else
    before_row := to_jsonb(old) - 'last_actor' - 'updated_at';
    -- A write that changes nothing records nothing.
    if before_row = after_row then
      new.last_actor := null;
      return new;
    end if;
    kind := case
      when old.deleted_at is null and new.deleted_at is not null then 'archive'
      when old.deleted_at is not null and new.deleted_at is null then 'restore'
      when old.section <> new.section then 'move'
      else 'edit'
    end;
  end if;

  insert into public.job_events (job_id, actor, action, before, after)
  values (new.id, coalesce(actor_name, 'unknown'), kind, before_row, after_row);

  new.last_actor := null;
  return new;
end;
$$;

-- BEFORE, so the trigger can clear last_actor on the row being written.
create trigger jobs_record_event
before insert or update on public.jobs
for each row execute function public.record_job_event();
