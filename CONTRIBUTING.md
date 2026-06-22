# Contributing to deckhandAI

Thanks for your interest. deckhandAI is a personal tool built for public use — contributions are welcome, especially bug fixes, scraper improvements, and documentation.

---

## Ground rules

- Keep it self-hosted and zero-infrastructure. No required external services beyond GitHub and an optional AI provider.
- No databases. The flat JSON data layer is intentional.
- No lock-in. AI generation must work with any OpenAI-compatible endpoint.
- Keep the setup path simple. A new user should be running in under 10 minutes.

---

## Getting started

```bash
git clone https://github.com/creativereason/deckhandAI.git
cd deckhandAI
pnpm install
node scripts/setup.mjs   # configure local env
pnpm dev
```

---

## What to work on

Check the [open issues](https://github.com/creativereason/deckhandAI/issues) first. Good areas for contributions:

- **Scraper targets** — adding new target formats (Greenhouse, Lever, Workday variants)
- **Bug fixes** — especially around edge cases in the scrape filter logic
- **AI provider support** — testing and fixing generation with different providers
- **Accessibility** — the tracker UI has not been audited
- **Documentation** — setup guides, troubleshooting, example configs

---

## Pull requests

- Open an issue before starting significant work so we can align on direction
- Keep PRs focused — one thing per PR
- Test your changes locally before opening a PR
- `data/jobs.json`, `data/config.json`, and `data/profile.json` are gitignored — never commit personal data files

---

## Code style

- TypeScript everywhere in `app/`, `components/`, and `lib/`
- Scripts in `scripts/` use ES modules (`.mjs` or `"type": "module"`)
- Run `pnpm lint` before submitting

---

## What this project is not trying to be

- A multi-user / team platform
- An ATS or HR system
- A service with a hosted version or SaaS offering

If your contribution pushes in those directions, it's better suited as a fork.
