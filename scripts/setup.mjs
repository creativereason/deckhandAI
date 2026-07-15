#!/usr/bin/env node
/**
 * deckhandAI setup — generates .env.local with the credentials needed to start the app.
 * Uses the GitHub CLI (gh) for auth when available; falls back to a manual PAT prompt.
 * Everything else (profile, location, job preferences, AI provider) is configured in the UI.
 * Run: node scripts/setup.mjs
 */

import { createInterface } from 'readline'
import { writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync, spawnSync } from 'child_process'
import crypto from 'crypto'
import { isValidRepoSpec, buildEnvFile, resolveTokenSource, repoAccessProblem, defaultModelFor, keyConsoleUrl } from './setup-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question, defaultVal = '') {
  return new Promise((resolve) => {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `
    rl.question(prompt, (answer) => resolve(answer.trim() || defaultVal))
  })
}

function section(title) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(50))
}

function warn(msg) {
  console.log(`\n  ⚠  ${msg}`)
}

function info(msg) {
  console.log(`  →  ${msg}`)
}

function ghOutput(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function ghInstalled() {
  return ghOutput(['--version']) !== null
}

function ghLoginInteractive() {
  // Inherit stdio so gh can drive its browser/device-code flow in this terminal.
  const result = spawnSync('gh', ['auth', 'login', '--web', '--git-protocol', 'https'], { stdio: 'inherit' })
  return result.status === 0
}

async function resolveGithubToken() {
  const decision = resolveTokenSource({ ghInstalled: ghInstalled(), ghToken: ghOutput(['auth', 'token']) })

  if (decision.source === 'gh') {
    info(`Using GitHub CLI token for ${ghOutput(['api', 'user', '--jq', '.login']) ?? 'unknown user'}.`)
    return decision.token
  }

  if (decision.source === 'login') {
    info('GitHub CLI found but not logged in — launching gh auth login...')
    if (ghLoginInteractive()) {
      const token = ghOutput(['auth', 'token'])
      if (token) return token
    }
    warn('gh login did not complete. Falling back to manual token entry.')
  } else {
    console.log('  GitHub CLI (gh) not found. Create a personal access token')
    console.log('  with repo scope at github.com/settings/tokens.\n')
  }

  return ask('GitHub personal access token')
}

async function resolveDataRepo(haveGh) {
  let repo = await ask('Data repo (owner/repo-name)')
  while (!isValidRepoSpec(repo)) {
    warn('Data repo must be in owner/repo format (e.g. citizenbob/job-data).')
    repo = await ask('Data repo (owner/repo-name)')
  }

  if (haveGh && ghOutput(['repo', 'view', repo, '--json', 'name']) === null) {
    const create = await ask(`Repo ${repo} not found. Create it as a private repo? (yes/no)`, 'yes')
    if (create.toLowerCase() === 'yes') {
      const created = ghOutput(['repo', 'create', repo, '--private'])
      if (created !== null) info(`Created private repo ${repo}.`)
      else warn(`Could not create ${repo} — create it manually before first run.`)
    }
  }

  return repo
}

async function verifyRepoAccess(token, repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  const problem = repoAccessProblem(res.status)
  if (problem) warn(problem)
  else info(`Token verified — it can access ${repo}.`)
}

async function main() {
  console.log('\n  deckhandAI setup\n')
  console.log('  This generates .env.local with the credentials needed to')
  console.log('  start the app. Your profile and job preferences are set up')
  console.log('  in the UI on first login.\n')

  const envPath = resolve(ROOT, '.env.local')

  if (existsSync(envPath)) {
    const overwrite = await ask('.env.local already exists. Overwrite? (yes/no)', 'no')
    if (overwrite.toLowerCase() !== 'yes') {
      console.log('\n  Setup cancelled. No files were changed.\n')
      rl.close()
      return
    }
  }

  // ── GitHub ───────────────────────────────────────────────────────────
  section('GitHub')
  console.log('  deckhandAI stores your job data in a private GitHub repo.\n')

  const githubToken = await resolveGithubToken()
  if (!githubToken) warn('No token available — GITHUB_TOKEN will be empty in .env.local.')

  const githubDataRepo = await resolveDataRepo(ghInstalled() && !!githubToken)
  const githubDataBranch = await ask('Branch', 'main')

  if (githubToken) await verifyRepoAccess(githubToken, githubDataRepo)

  // ── App auth ─────────────────────────────────────────────────────────
  section('App password')
  console.log('  Set a password to protect your tracker UI.\n')

  const appPassword = await ask('App password')
  const cookieSecret = crypto.randomBytes(32).toString('hex')
  info(`Cookie secret auto-generated (${cookieSecret.slice(0, 8)}...)`)

  // ── AI provider ──────────────────────────────────────────────────────
  section('AI provider (optional)')
  console.log('  Used for cover letter and resume generation. The API key')
  console.log('  lives in .env.local only — it is never stored in config or')
  console.log('  sent to the browser. Press Enter to skip and set up later')
  console.log('  by re-running this script.\n')
  console.log('  Providers: anthropic, openai, gemini, grok, ollama, custom\n')

  let ai
  const provider = await ask('Provider (Enter to skip)')
  if (provider) {
    const model = await ask('Model', defaultModelFor(provider))
    const consoleUrl = keyConsoleUrl(provider)
    if (consoleUrl) {
      info(`Opening ${consoleUrl} — create a key there and paste it below.`)
      // Best-effort browser open; the URL is printed either way.
      spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [consoleUrl], { stdio: 'ignore' })
    }
    const apiKey = provider === 'ollama' ? 'ollama' : await ask('API key')
    const baseUrl = provider === 'custom' ? await ask('Base URL (OpenAI-compatible)')
      : provider === 'ollama' ? await ask('Base URL', 'http://localhost:11434/v1')
      : ''
    ai = { provider, model, apiKey, ...(baseUrl ? { baseUrl } : {}) }
    if (!apiKey) warn('No API key entered — generation will stay disabled.')
  }

  // ── Write .env.local ─────────────────────────────────────────────────
  section('Writing files')

  writeFileSync(envPath, buildEnvFile({ githubToken, githubDataRepo, githubDataBranch, appPassword, cookieSecret, ai }))
  info('Wrote .env.local')

  // ── Next steps ────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`)
  console.log('\n  Setup complete.\n')
  console.log('  Start the app and finish setup in the UI:\n')
  console.log('    yarn dev\n')
  console.log('  On first login, you\'ll be walked through your profile,')
  console.log('  location, and job preferences. You can change AI provider')
  console.log('  or model later in Settings → AI Model, or re-run this script')
  console.log('  to rotate the API key.\n')
  console.log('  Deploying to Vercel? Add every line of .env.local as an')
  console.log('  env var in your project settings.\n')

  rl.close()
}

main().catch((err) => {
  console.error('\n  Setup failed:', err.message)
  process.exit(1)
})
