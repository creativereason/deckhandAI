# Agent API

For Grokbot, Muse, Duet and scripts. Base path: `/api/agent/v1`. Needs `DATA_BACKEND=supabase`.

## Authentication

Create an agent in the app (Settings, once that page lands) or with `POST /api/agents` while signed in. The response includes the key **once**: `dk_...`. Send it on every request:

```
Authorization: Bearer dk_...
```

Each agent has scopes. A key without the scope an operation needs gets `403`. A bad, unknown or revoked key gets `401` (the same answer for all three).

## Scopes and operations

| Operation | Request | Scope |
|-----------|---------|-------|
| List jobs | `GET /jobs?section=&limit=&offset=` (limit 1 to 500, default 100) | `jobs:read` |
| Get a job | `GET /jobs/{id}` | `jobs:read` |
| Add to the inbox | `POST /jobs` | `jobs:add_pending` |
| Edit notes, `aiSummary`, `scoreRationale`, `fit` | `PATCH /jobs/{id}` | `jobs:edit` |
| Move between sections | `POST /jobs/{id}/move` with `{ "to": "prospect" }` | `jobs:triage` |
| Archive (soft delete) | `POST /jobs/{id}/archive` | `jobs:archive` |

There is no hard delete and no restore. Restoring stays with the signed-in user.

### Adding a job

```
POST /api/agent/v1/jobs
{ "company": "Acme", "role": "Designer", "url": "https://example.com/jobs/1", "notes": "..." }
```

Optional: `salary`, `aiSummary`, `scrapeGroup` (`remote` | `local`). Jobs always land in `pending`. The URL must be `http(s)` or empty. Unknown fields are rejected.

A job that is already tracked (same URL, or same company and role, in any section, **including archived jobs**) returns `409` with `{ "existing": { "id", "section", "deleted" } }`. Nothing is added.

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Invalid body or query. `issues` lists each field path |
| 401 | Missing, unknown or revoked key |
| 403 | Valid key, missing scope |
| 404 | Unknown, malformed or archived job id |
| 409 | Duplicate job, or the backend is not Supabase |
| 429 | Over the per-agent limit; see `Retry-After` |

## Limits

120 requests per minute per agent (`AGENT_RATE_LIMIT` to change). The window is held in memory per server instance, so it stops a runaway agent but is not a billing quota.

## Audit

Every change an agent makes is recorded in `job_events` under the agent's name.

## MCP server

`POST /api/mcp` is a Model Context Protocol endpoint (Streamable HTTP, JSON responses, stateless; no GET or streaming). It uses the same `Authorization: Bearer dk_...` key and the same operations as the HTTP API, so the rules are identical.

| Tool | Scope | Does |
|------|-------|------|
| `list_jobs` | `jobs:read` | list jobs (`section`, `limit`, `offset`) |
| `get_job` | `jobs:read` | one job by `id` |
| `add_pending_job` | `jobs:add_pending` | add to the inbox only |
| `update_job` | `jobs:edit` | `notes`, `aiSummary`, `scoreRationale`, `fit` |
| `move_job` | `jobs:triage` | move to another section |
| `archive_job` | `jobs:archive` | soft delete |

A tool your key's scopes don't cover is not listed, and calling it by name answers "Unknown tool". Failures such as validation errors or duplicates come back as tool results with `isError: true` and the same `error` text as the HTTP API. There is no delete or restore tool. Text read from a job is untrusted data; the server tells the model so and never acts on instructions found in it.

Example client config (Claude Code):

```
claude mcp add --transport http deckhand https://YOUR-HOST/api/mcp --header "Authorization: Bearer dk_..."
```
