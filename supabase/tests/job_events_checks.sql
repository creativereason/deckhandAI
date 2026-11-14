-- Behavior checks for the job_events trigger. Run in the Supabase SQL editor after
-- migration 20261114120000_job_events.sql is applied. A failing check raises an
-- exception naming it; no error means every check passed. Rolls back, so nothing persists.
begin;

do $$
declare
  jid uuid;
  n int;
  ev record;
begin
  -- create: actor comes from last_actor, there is no "before"
  insert into public.jobs (section, company, role, last_actor) values ('prospect', '__evt_check', 'r', 'user') returning id into jid;
  select * into ev from public.job_events where job_id = jid order by created_at desc, id limit 1;
  if ev.action <> 'create' or ev.actor <> 'user' or ev.before is not null then raise exception 'FAIL create: %', to_jsonb(ev); end if;

  -- edit by a named actor
  update public.jobs set notes = 'n1', last_actor = 'muse' where id = jid;
  select * into ev from public.job_events where job_id = jid and action = 'edit';
  if ev.actor <> 'muse' or ev.before->>'notes' <> '' or ev.after->>'notes' <> 'n1' then raise exception 'FAIL edit: %', to_jsonb(ev); end if;

  -- last_actor never goes stale: a write that names nobody is 'unknown', and the column is cleared
  update public.jobs set notes = 'n2' where id = jid;
  select count(*) into n from public.job_events where job_id = jid and actor = 'unknown';
  if n <> 1 then raise exception 'FAIL stale actor: % unknown events', n; end if;
  if (select last_actor from public.jobs where id = jid) is not null then raise exception 'FAIL last_actor not cleared'; end if;

  -- a write that changes nothing records nothing
  select count(*) into n from public.job_events where job_id = jid;
  update public.jobs set notes = notes, last_actor = 'user' where id = jid;
  if (select count(*) from public.job_events where job_id = jid) <> n then raise exception 'FAIL unchanged write recorded an event'; end if;

  -- an upsert that updates records one edit and no false create
  select count(*) into n from public.job_events where job_id = jid;
  insert into public.jobs (id, section, company, role, notes, last_actor)
  values (jid, 'prospect', '__evt_check', 'r', 'n3', 'muse')
  on conflict (id) do update set notes = excluded.notes, last_actor = excluded.last_actor;
  if (select count(*) from public.job_events where job_id = jid) <> n + 1 then raise exception 'FAIL upsert recorded % events', (select count(*) from public.job_events where job_id = jid) - n; end if;
  if (select count(*) from public.job_events where job_id = jid and action = 'create') <> 1 then raise exception 'FAIL upsert recorded a false create'; end if;

  -- move, archive, restore
  update public.jobs set section = 'passed', last_actor = 'user' where id = jid;
  update public.jobs set deleted_at = now(), last_actor = 'grokbot' where id = jid;
  update public.jobs set deleted_at = null, last_actor = 'user' where id = jid;
  select count(*) into n from public.job_events where job_id = jid and action in ('move', 'archive', 'restore');
  if n <> 3 then raise exception 'FAIL move/archive/restore: % events', n; end if;
  if (select actor from public.job_events where job_id = jid and action = 'archive') <> 'grokbot' then raise exception 'FAIL archive actor'; end if;

  -- the script path: an insert with no last_actor is attributed to its source
  insert into public.jobs (section, company, role, source) values ('pending', '__evt_check', 'script', 'scraper') returning id into jid;
  if (select actor from public.job_events where job_id = jid) <> 'scraper' then raise exception 'FAIL source fallback'; end if;

  -- append-only: the server key can read and add, never change or erase
  set local role service_role;
  begin
    update public.job_events set actor = 'tampered';
    raise exception 'FAIL service_role could update job_events';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.job_events;
    raise exception 'FAIL service_role could delete from job_events';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
