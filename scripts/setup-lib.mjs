/**
 * Pure decision logic for scripts/setup.mjs — kept free of I/O so it is unit-testable.
 */

export function isValidRepoSpec(spec) {
  const parts = spec.split('/')
  return parts.length === 2 && parts.every((p) => p.length > 0)
}

export function buildEnvFile(config) {
  const lines = [
    `GITHUB_TOKEN=${config.githubToken}`,
    `GITHUB_DATA_REPO=${config.githubDataRepo}`,
    `GITHUB_DATA_BRANCH=${config.githubDataBranch}`,
    `APP_PASSWORD=${config.appPassword}`,
    `COOKIE_SECRET=${config.cookieSecret}`,
  ]
  if (config.ai) {
    lines.push(`AI_PROVIDER=${config.ai.provider}`, `AI_MODEL=${config.ai.model}`, `AI_API_KEY=${config.ai.apiKey}`)
    if (config.ai.baseUrl) lines.push(`AI_BASE_URL=${config.ai.baseUrl}`)
  }
  return lines.join('\n') + '\n'
}

export function defaultModelFor(provider) {
  const defaults = {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.0-flash',
    grok: 'grok-3-mini',
    ollama: 'llama3.1',
  }
  return defaults[provider] ?? ''
}

export function repoAccessProblem(status) {
  if (status === 200) return null
  if (status === 404) return 'That repo does not exist or the token cannot access it. Fine-grained PATs must be granted the repo explicitly.'
  if (status === 401) return 'The token was rejected by GitHub — it may be expired or revoked.'
  return `GitHub responded with status ${status} when checking repo access.`
}

export function keyConsoleUrl(provider) {
  const urls = {
    anthropic: 'https://console.anthropic.com/settings/keys',
    openai: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/apikey',
    grok: 'https://console.x.ai',
  }
  return urls[provider] ?? null
}

export function resolveTokenSource({ ghInstalled, ghToken }) {
  if (!ghInstalled) return { source: 'manual' }
  if (!ghToken) return { source: 'login' }
  return { source: 'gh', token: ghToken }
}
