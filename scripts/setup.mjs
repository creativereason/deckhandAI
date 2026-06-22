#!/usr/bin/env node
/**
 * deckhandAI setup — generates .env.local with the credentials needed to start the app.
 * Everything else (profile, location, job preferences, AI provider) is configured in the UI.
 * Run: node scripts/setup.mjs
 */

import { createInterface } from 'readline'
import { writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

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
  console.log('  deckhandAI stores your job data in a private GitHub repo.')
  console.log('  Create a new private repo (e.g. "job-data") and a personal')
  console.log('  access token with repo scope at github.com/settings/tokens.\n')

  const githubToken = await ask('GitHub personal access token')
  const githubDataRepo = await ask('Data repo (owner/repo-name)')
  const githubDataBranch = await ask('Branch', 'main')

  if (!githubToken) warn('No token entered — GITHUB_TOKEN will be empty in .env.local.')
  if (!githubDataRepo.includes('/')) warn('Data repo should be in owner/repo format.')

  // ── App auth ─────────────────────────────────────────────────────────
  section('App password')
  console.log('  Set a password to protect your tracker UI.\n')

  const appPassword = await ask('App password')
  const cookieSecret = crypto.randomBytes(32).toString('hex')
  info(`Cookie secret auto-generated (${cookieSecret.slice(0, 8)}...)`)

  // ── Write .env.local ─────────────────────────────────────────────────
  section('Writing files')

  const envLines = [
    `GITHUB_TOKEN=${githubToken}`,
    `GITHUB_DATA_REPO=${githubDataRepo}`,
    `GITHUB_DATA_BRANCH=${githubDataBranch}`,
    `APP_PASSWORD=${appPassword}`,
    `COOKIE_SECRET=${cookieSecret}`,
  ]

  writeFileSync(envPath, envLines.join('\n') + '\n')
  info('Wrote .env.local')

  // ── Next steps ────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`)
  console.log('\n  Setup complete.\n')
  console.log('  Start the app and finish setup in the UI:\n')
  console.log('    pnpm dev\n')
  console.log('  On first login, you\'ll be walked through your profile,')
  console.log('  location, and job preferences. AI provider setup is in')
  console.log('  Settings → AI Model.\n')
  console.log('  Deploying to Vercel? Add these env vars in your project')
  console.log('  settings (same values as .env.local):')
  console.log('    GITHUB_TOKEN, GITHUB_DATA_REPO, GITHUB_DATA_BRANCH,')
  console.log('    APP_PASSWORD, COOKIE_SECRET\n')

  rl.close()
}

main().catch((err) => {
  console.error('\n  Setup failed:', err.message)
  process.exit(1)
})
