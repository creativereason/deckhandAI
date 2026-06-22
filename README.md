# deckhandAI

A self-hosted job search command center. Track prospects, scrape target company career pages, and generate cover letters with any AI model — no vendor lock-in, no database, no monthly fee.

---

## What it does

- **Kanban/table tracker** — prospects, applied, local, staffing, and passed buckets
- **Automated scraping** — Playwright-based scraper hits target career pages on a schedule via GitHub Actions
- **AI document generation** — bring your own model (Anthropic, OpenAI, Ollama, or any OpenAI-compatible endpoint) to draft cover letters and resume tailoring notes
- **Zero infrastructure** — data lives in flat JSON files in your own private GitHub repo; deploy the UI to Vercel for free

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/creativereason/deckhandAI.git
cd deckhandAI
pnpm install

# 2. Set up your data file
cp data/jobs.sample.json data/jobs.json

# 3. Set up your config
cp data/config.sample.json data/config.json
# Edit config.json with your name, location, salary floor, and target titles

# 4. Run locally
pnpm dev   # http://localhost:3000
```

---

## Configuration

Edit `data/config.json` (copied from `data/config.sample.json`) to set:

- Your name, location, and contact info
- Target job titles and seniority levels
- Salary minimum (FTE and contract/hourly)
- Location preferences (remote, hybrid radius, hub city/ZIP)
- AI provider and model (for document generation)

See `data/config.sample.json` for the full schema with all available options.

---

## Scraping

Add your target companies to `scripts/scrape-careers.mjs`. The file includes several example targets to show the format. Run it directly or let GitHub Actions run it on a schedule.

```bash
node scripts/scrape-careers.mjs
```

Requires Playwright with Chromium:
```bash
npx playwright install chromium
```

---

## AI document generation

Set your provider and model in `data/config.json`:

```json
{
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "base_url": null
  }
}
```

Add your API key to `.env.local`:
```
AI_API_KEY=your-key-here
```

Supported providers: `anthropic`, `openai`, `ollama`, `custom`. For Ollama or a custom endpoint, set `base_url` to your server address.

---

## Deployment

Deploy to Vercel in one click. Set `AI_API_KEY` as an environment variable in your Vercel project settings.

---

## Data privacy

`jobs.json` is gitignored by default. Your job search data, salary notes, and application history never leave your own deployment. AI generation happens server-to-model — your data is never sent to a third-party service beyond the AI provider you configure.

---

## License

MIT
