-- Behavior checks for the agents table. Run in the Supabase SQL editor after migration
-- 20261114130000_agents.sql is applied. A failing check raises an exception naming it; no
-- error means every check passed. Rolls back, so nothing persists.
begin;

do $$
declare
  aid uuid;
begin
  -- a new agent gets the narrow default scopes
  insert into public.agents (name, key_hash, key_prefix) values ('CheckBot', 'hash-1', 'dk_check01') returning id into aid;
  if (select scopes from public.agents where id = aid) <> array['jobs:read', 'jobs:add_pending'] then raise exception 'FAIL default scopes'; end if;

  -- one agent per name, whatever the capitalisation
  begin
    insert into public.agents (name, key_hash, key_prefix) values ('checkbot', 'hash-2', 'dk_check02');
    raise exception 'FAIL duplicate name accepted';
  exception when unique_violation then null; end;

  -- one row per key
  begin
    insert into public.agents (name, key_hash, key_prefix) values ('Other', 'hash-1', 'dk_check03');
    raise exception 'FAIL duplicate key hash accepted';
  exception when unique_violation then null; end;

  -- scopes must be known, and there must be at least one
  begin
    insert into public.agents (name, key_hash, key_prefix, scopes) values ('Bad1', 'h3', 'p', array['jobs:delete']);
    raise exception 'FAIL unknown scope accepted';
  exception when check_violation then null; end;
  begin
    insert into public.agents (name, key_hash, key_prefix, scopes) values ('Bad2', 'h4', 'p', '{}');
    raise exception 'FAIL empty scopes accepted';
  exception when check_violation then null; end;
  begin
    insert into public.agents (name, key_hash, key_prefix) values (repeat('x', 41), 'h5', 'p');
    raise exception 'FAIL overlong name accepted';
  exception when check_violation then null; end;

  -- the server key can read, add, and change scopes / revoked_at / last_used_at
  set local role service_role;
  perform 1 from public.agents where id = aid;
  update public.agents set scopes = array['jobs:read', 'jobs:edit'], revoked_at = now(), last_used_at = now() where id = aid;
  insert into public.agents (name, key_hash, key_prefix) values ('CheckBot2', 'hash-9', 'dk_check09');

  -- but it cannot rename an agent, swap its key, or erase anything
  begin
    update public.agents set name = 'Hijack' where id = aid;
    raise exception 'FAIL service_role could rename an agent';
  exception when insufficient_privilege then null; end;
  begin
    update public.agents set key_hash = 'swapped' where id = aid;
    raise exception 'FAIL service_role could swap a key hash';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.agents where id = aid;
    raise exception 'FAIL service_role could delete an agent';
  exception when insufficient_privilege then null; end;
  begin
    truncate public.agents;
    raise exception 'FAIL service_role could truncate agents';
  exception when insufficient_privilege then null; end;
  reset role;

  -- the browser-facing roles get nothing, not even a read of the hashes
  set local role anon;
  begin
    perform 1 from public.agents;
    raise exception 'FAIL anon could read agents';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  begin
    perform 1 from public.agents;
    raise exception 'FAIL authenticated could read agents';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

rollback;
