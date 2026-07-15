import { describe, it, expect } from 'vitest'
import { isValidRepoSpec, buildEnvFile, resolveTokenSource, repoAccessProblem, defaultModelFor, keyConsoleUrl } from '../setup-lib.mjs'

describe('isValidRepoSpec', () => {
  // Z
  it('returns false when the spec is an empty string', () => {
    expect(isValidRepoSpec('')).toBe(false)
  })

  // O
  it('returns true when the spec is a single owner/repo pair', () => {
    expect(isValidRepoSpec('bob/job-data')).toBe(true)
  })

  // B
  it('returns false when the spec has no slash', () => {
    expect(isValidRepoSpec('job-data')).toBe(false)
  })

  it('returns false when owner or repo segment is empty', () => {
    expect(isValidRepoSpec('/job-data')).toBe(false)
    expect(isValidRepoSpec('bob/')).toBe(false)
  })

  // E
  it('returns false when the spec has more than one slash', () => {
    expect(isValidRepoSpec('github.com/bob/job-data')).toBe(false)
  })
})

describe('buildEnvFile', () => {
  // Z
  it('returns lines with empty values when config fields are empty strings', () => {
    const env = buildEnvFile({ githubToken: '', githubDataRepo: '', githubDataBranch: '', appPassword: '', cookieSecret: '' })
    expect(env).toContain('GITHUB_TOKEN=\n')
  })

  // O
  it('returns one KEY=value line per field, newline-terminated, when all fields are set', () => {
    const env = buildEnvFile({
      githubToken: 'tok',
      githubDataRepo: 'bob/job-data',
      githubDataBranch: 'main',
      appPassword: 'pw',
      cookieSecret: 'sec',
    })
    expect(env).toBe(
      'GITHUB_TOKEN=tok\nGITHUB_DATA_REPO=bob/job-data\nGITHUB_DATA_BRANCH=main\nAPP_PASSWORD=pw\nCOOKIE_SECRET=sec\n'
    )
  })

  // B — AI config is optional and must not emit empty lines when absent
  it('omits all AI_* lines when no ai config is given', () => {
    const env = buildEnvFile({ githubToken: 't', githubDataRepo: 'a/b', githubDataBranch: 'main', appPassword: 'p', cookieSecret: 's' })
    expect(env).not.toContain('AI_')
  })

  it('appends AI_PROVIDER, AI_MODEL and AI_API_KEY lines when ai config is given', () => {
    const env = buildEnvFile({
      githubToken: 't', githubDataRepo: 'a/b', githubDataBranch: 'main', appPassword: 'p', cookieSecret: 's',
      ai: { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-x' },
    })
    expect(env).toContain('AI_PROVIDER=anthropic\n')
    expect(env).toContain('AI_MODEL=claude-sonnet-4-6\n')
    expect(env).toContain('AI_API_KEY=sk-ant-x\n')
    expect(env).not.toContain('AI_BASE_URL')
  })

  it('appends AI_BASE_URL only when the ai config includes a base url', () => {
    const env = buildEnvFile({
      githubToken: 't', githubDataRepo: 'a/b', githubDataBranch: 'main', appPassword: 'p', cookieSecret: 's',
      ai: { provider: 'ollama', model: 'llama3.1', apiKey: 'ollama', baseUrl: 'http://localhost:11434/v1' },
    })
    expect(env).toContain('AI_BASE_URL=http://localhost:11434/v1\n')
  })
})

describe('defaultModelFor', () => {
  // O — the app's own fallback provider
  it('returns the app default claude model for anthropic', () => {
    expect(defaultModelFor('anthropic')).toBe('claude-sonnet-4-6')
  })

  it('returns a sensible default for each other known provider', () => {
    expect(defaultModelFor('openai')).toBe('gpt-4o-mini')
    expect(defaultModelFor('gemini')).toBe('gemini-2.0-flash')
    expect(defaultModelFor('grok')).toBe('grok-3-mini')
    expect(defaultModelFor('ollama')).toBe('llama3.1')
  })

  // E — unknown provider has no safe default
  it('returns an empty string for an unknown provider', () => {
    expect(defaultModelFor('custom')).toBe('')
  })
})

describe('keyConsoleUrl', () => {
  // O
  it('returns the Anthropic Console keys page for anthropic', () => {
    expect(keyConsoleUrl('anthropic')).toBe('https://console.anthropic.com/settings/keys')
  })

  it('returns each provider\'s key-creation page for other hosted providers', () => {
    expect(keyConsoleUrl('openai')).toBe('https://platform.openai.com/api-keys')
    expect(keyConsoleUrl('gemini')).toBe('https://aistudio.google.com/apikey')
    expect(keyConsoleUrl('grok')).toBe('https://console.x.ai')
  })

  // Z/E — providers with no key page
  it('returns null for ollama and unknown providers', () => {
    expect(keyConsoleUrl('ollama')).toBeNull()
    expect(keyConsoleUrl('custom')).toBeNull()
  })
})

describe('resolveTokenSource', () => {
  // Z — gh absent entirely
  it('returns manual source when gh is not installed', () => {
    expect(resolveTokenSource({ ghInstalled: false, ghToken: null })).toEqual({ source: 'manual' })
  })

  // O — gh installed and already authenticated
  it('returns gh source with the token when gh is installed and logged in', () => {
    expect(resolveTokenSource({ ghInstalled: true, ghToken: 'gho_abc' })).toEqual({ source: 'gh', token: 'gho_abc' })
  })

  // B — gh installed but not logged in yet
  it('returns login source when gh is installed but has no token', () => {
    expect(resolveTokenSource({ ghInstalled: true, ghToken: null })).toEqual({ source: 'login' })
  })

  it('treats an empty-string token the same as no token', () => {
    expect(resolveTokenSource({ ghInstalled: true, ghToken: '' })).toEqual({ source: 'login' })
  })
})

describe('repoAccessProblem', () => {
  // O — the happy path
  it('returns null when the API responds 200', () => {
    expect(repoAccessProblem(200)).toBeNull()
  })

  // B — 404 is how GitHub reports both "missing" and "no access" for private repos
  it('returns a not-found-or-no-access message when the API responds 404', () => {
    expect(repoAccessProblem(404)).toMatch(/does not exist or the token cannot access it/)
  })

  // E — bad credentials
  it('returns a bad-token message when the API responds 401', () => {
    expect(repoAccessProblem(401)).toMatch(/token was rejected/)
  })

  it('returns a generic message with the status code for any other failure', () => {
    expect(repoAccessProblem(500)).toMatch(/500/)
  })
})
