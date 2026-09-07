const GITHUB_REPO_PATTERN =
  /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i

const RESERVED_OWNERS = new Set(['gist', 'orgs', 'login', 'settings', 'marketplace'])

const MANIFEST_FILES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
]

const DEFAULT_TIMEOUT_MS = 12_000
const MAX_README_CHARS = 8_000
const MAX_MANIFEST_CHARS = 2_000
const MAX_TOTAL_CHARS = 12_000

const cache = new Map()
const CACHE_TTL_MS = 15 * 60 * 1000

export function parseGithubRepoUrl(text) {
  const match = String(text ?? '').match(GITHUB_REPO_PATTERN)

  if (!match) {
    return null
  }

  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '')

  if (RESERVED_OWNERS.has(owner.toLowerCase())) {
    return null
  }

  if (['issues', 'pull', 'discussions', 'wiki', 'settings', 'blob', 'tree'].includes(repo.toLowerCase())) {
    return null
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  }
}

const fetchWithTimeout = async (url, options = {}, fetchImpl = fetch) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

const readResponseText = async (response, maxChars) => {
  const text = await response.text()
  return text.slice(0, maxChars)
}

export async function fetchGithubProjectSnapshot(repoUrl, { fetchImpl = fetch } = {}) {
  const parsed = typeof repoUrl === 'string' ? parseGithubRepoUrl(repoUrl) : repoUrl

  if (!parsed) {
    return { error: 'No valid GitHub repository URL was found.', text: '' }
  }

  const cacheKey = `${parsed.owner}/${parsed.repo}`
  const cached = cache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const repoResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'swinlearn-submission-indexer',
      },
    },
    fetchImpl,
  )

  if (!repoResponse.ok) {
    const value = {
      error:
        repoResponse.status === 404
          ? 'Repository not found or private.'
          : `GitHub repository lookup failed (${repoResponse.status}).`,
      text: '',
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value })
    return value
  }

  const sections = [`Repo: ${parsed.owner}/${parsed.repo}`]
  let totalChars = sections[0].length

  const readmeResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`,
    {
      headers: {
        Accept: 'application/vnd.github.raw',
        'User-Agent': 'swinlearn-submission-indexer',
      },
    },
    fetchImpl,
  )

  if (readmeResponse.ok) {
    const readmeText = await readResponseText(readmeResponse, MAX_README_CHARS)

    if (readmeText.trim()) {
      sections.push('README', readmeText.trim())
      totalChars += readmeText.length
    }
  }

  for (const manifest of MANIFEST_FILES) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      break
    }

    const manifestResponse = await fetchWithTimeout(
      `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/HEAD/${manifest}`,
      {
        headers: { 'User-Agent': 'swinlearn-submission-indexer' },
      },
      fetchImpl,
    )

    if (!manifestResponse.ok) {
      continue
    }

    const manifestText = await readResponseText(
      manifestResponse,
      Math.min(MAX_MANIFEST_CHARS, MAX_TOTAL_CHARS - totalChars),
    )

    if (manifestText.trim()) {
      sections.push(manifest, manifestText.trim())
      totalChars += manifestText.length
    }
  }

  if (sections.length === 1) {
    const value = {
      error: 'Repository is public but no README or manifest files could be read.',
      text: '',
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value })
    return value
  }

  const value = { error: null, text: sections.join('\n\n').slice(0, MAX_TOTAL_CHARS) }
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value })
  return value
}
