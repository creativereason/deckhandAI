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
yarn install
node scripts/setup.mjs   # configure local env
yarn dev
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
- `data/jobs.json`, `data/config.json`, and `data/profile.json` are gitignored — never commit personal data files

Run all three before opening a PR. They must be clean:

```bash
yarn tsc --noEmit   # type check
yarn lint           # ESLint
yarn test           # Vitest
```

---

## Code style

- TypeScript everywhere in `app/`, `components/`, and `lib/`
- Scripts in `scripts/` use ES modules (`.mjs` or `"type": "module"`)
- Pure logic goes in a testable module with a test; I/O stays in a thin shell around it. `scripts/setup-lib.mjs` and `scripts/setup.mjs` are the reference example.
- `CLAUDE.md` documents the fuller quality bar (TDD protocol, SOLID, domain boundaries) if you want the reasoning behind the shape of the code.

---

## What this project is not trying to be

- A multi-user / team platform
- An ATS or HR system
- A service with a hosted version or SaaS offering

If your contribution pushes in those directions, it's better suited as a fork.
