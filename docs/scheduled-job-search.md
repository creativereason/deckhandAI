# Scheduled Job Search

deckhandAI supports automated job searching via Claude Code's cloud scheduling. Once configured, a scheduled agent runs on your chosen cadence, searches for qualifying roles, and writes them directly to the `pending` queue in your private data repo — ready for triage in the UI.

---

## How it works

Claude Code can schedule a recurring prompt that fires into a session on a cron schedule. When it fires, the agent reads your `data/config.json` for search criteria (titles, salary floor, location preferences), searches for matching roles, deduplicates against your existing `jobs.json`, and commits any new finds to your GitHub data repo.

---

## Prerequisites

Before setting up a schedule, confirm:

1. **deckhandAI is deployed and running** — local or on Vercel (see [DEPLOY.md](../DEPLOY.md))
2. **Your data repo is configured** — `.env.local` must have:
   ```
   GITHUB_TOKEN=your_pat_here
   GITHUB_DATA_REPO=your-org/your-private-repo
   GITHUB_DATA_BRANCH=main
   ```
3. **`data/config.json` has your search preferences** — titles, salary floor, location hub, and `websearch_passes` queries. See `data/config.sample.json` for the shape.
4. **You are in a Claude Code session** inside the deckhandAI project directory

---

## Search methods

There are two search methods. Use them together or separately depending on your Claude plan.

### WebSearch pass — available on any Claude Code plan

Uses web search to query job boards directly (Ashby, Greenhouse, Lever, Built In). This works in the Claude CLI, desktop app, web app, and IDE extensions.

Queries come from `data/config.json` under `websearch_passes`. The agent runs all groups: `job_boards_director`, `job_boards_ic`, `local`, and `companies`.

### Indeed MCP pass — claude.ai only

Uses the Indeed MCP integration to search Indeed's live job index directly. This integration is only available on **claude.ai** (the web app at claude.ai/code or the claude.ai desktop app). It is not available in the open-source CLI or self-hosted deployments.

---

## Setting up a schedule

Use the `/schedule` skill inside a Claude Code session. Open Claude Code in the deckhandAI project directory and run:

```
/schedule
```

Claude will ask for the cadence and the prompt to run. Suggested setup:

**Cadence:** Weekly — `0 9 * * 1` (Mondays at 9am UTC)

**Prompt for WebSearch pass (all users):**
```
Run the weekly WebSearch job search pass for deckhandAI. Read data/config.json for my search preferences and websearch_passes queries. For each query, search the web, filter results against my title preferences and salary floor, skip any URL already in jobs.json, and add qualifying roles to the pending section of jobs.json in the GitHub data repo. Use the GitHub API write flow documented in CLAUDE.md. Commit with message: "Add N jobs to pending queue via WebSearch pass"
```

**Prompt for Indeed MCP pass (claude.ai only):**
```
Run the weekly Indeed MCP job search pass for deckhandAI. Read data/config.json for my search preferences. Search Indeed using the mcp__claude_ai_Indeed__search_jobs tool for each of my target titles. Filter results against my salary floor and location preferences, skip any URL already in jobs.json, and add qualifying roles to the pending section of jobs.json in the GitHub data repo. Use the GitHub API write flow documented in CLAUDE.md. Commit with message: "Add N jobs to pending queue via Indeed MCP"
```

**Running both in one trigger:**
You can combine both passes into a single weekly trigger prompt — just concatenate the instructions and note that Indeed MCP is a bonus step if the tool is available.

---

## Managing your schedule

List active schedules:
```
/schedule list
```

To pause, update the cadence, or delete a schedule, run `/schedule` again — Claude will show your existing triggers and offer to modify them.

---

## Reviewing results

After each scheduled run, new jobs appear in the **Pending** section of the deckhandAI UI. From there you can:
- **Promote** to Prospect or Applied
- **Pass** on roles that don't fit
- **Score** fit against your profile (if AI generation is configured)

The pending queue is append-only from the agent — it never moves or deletes existing jobs.

---

## Troubleshooting

**No jobs added after a run**
- Check that `data/config.json` has `websearch_passes` defined with at least one query group
- Verify `GITHUB_TOKEN` has write access to your data repo
- Check that salary and location filters aren't too restrictive

**Indeed MCP tool not found**
- You are not on claude.ai — switch to the WebSearch pass instead

**Duplicate jobs appearing**
- The deduplication logic matches on `url` first, then `company`+`role`. If a job board changes a listing URL, it may be re-added. Review and pass duplicates in the UI.
