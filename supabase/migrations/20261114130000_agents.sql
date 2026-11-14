-- Slice 21: identities for agents (Grokbot, Muse, Duet, ...). An agent authenticates with
-- its own revocable key and can do only what its scopes allow. The key is shown once at
-- creation and only its SHA-256 hash is stored here.
create table public.agents (
  id            uuid primary key default gen_random_uuid(),
  -- Becomes the actor in job_events, so it is permanent (see the column grants below).
  name          text not null check (char_length(name) between 1 and 40),
  key_hash      text not null unique,
  -- Non-secret start of the key: finds the row on login and tells keys apart in a list.
  key_prefix    text not null,
  scopes        text[] not null default array['jobs:read', 'jobs:add_pending']
                  check (
                    cardinality(scopes) >= 1
                    and scopes <@ array['jobs:read', 'jobs:add_pending', 'jobs:edit', 'jobs:triage',
                                        'jobs:evaluate', 'jobs:check_url', 'jobs:archive']
                  ),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  last_used_at  timestamptz
);

-- One agent per name, however it is capitalised.
create unique index agents_name_lower_idx on public.agents (lower(name));
create index agents_key_prefix_idx on public.agents (key_prefix);

-- Same stance as jobs: RLS on, no policies, server key only. Key hashes are secrets-adjacent,
-- so the browser-facing roles get no table privileges at all.
alter table public.agents enable row level security;
revoke all on public.agents from anon, authenticated;

-- Agents are never erased: revoking sets revoked_at, so history stays attributable.
revoke delete, truncate on public.agents from service_role;

-- After creation only scopes, revoked_at and last_used_at can change. The name and the key
-- hash cannot, so no bug or compromised caller can swap an agent's key or rename it.
revoke update on public.agents from service_role;
grant update (scopes, revoked_at, last_used_at) on public.agents to service_role;
