import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fetchGithubProjectSnapshot,
  parseGithubRepoUrl,
} from './githubProjectSnapshot.js'

test('parseGithubRepoUrl extracts first valid repo URL from text', () => {
  assert.deepEqual(
    parseGithubRepoUrl('See https://github.com/acme/cool-app for details'),
    { owner: 'acme', repo: 'cool-app', url: 'https://github.com/acme/cool-app' },
  )
  assert.deepEqual(
    parseGithubRepoUrl('https://www.github.com/student/capstone-project/tree/main'),
    {
      owner: 'student',
      repo: 'capstone-project',
      url: 'https://github.com/student/capstone-project',
    },
  )
})

test('parseGithubRepoUrl ignores gist links and invalid paths', () => {
  assert.equal(parseGithubRepoUrl('https://gist.github.com/user/abc123'), null)
  assert.equal(parseGithubRepoUrl('https://github.com/acme/issues'), null)
  assert.equal(parseGithubRepoUrl('No link here'), null)
  assert.deepEqual(parseGithubRepoUrl('https://github.com/acme/repo/issues/1'), {
    owner: 'acme',
    repo: 'repo',
    url: 'https://github.com/acme/repo',
  })
})

test('fetchGithubProjectSnapshot returns README and manifest excerpts', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, accept: options.headers?.Accept })

    if (url === 'https://api.github.com/repos/acme/demo') {
      return { ok: true, status: 200, text: async () => '{}' }
    }

    if (url === 'https://api.github.com/repos/acme/demo/readme') {
      return {
        ok: true,
        status: 200,
        text: async () => '# Demo App\n\nBuilt with React and Node.',
      }
    }

    if (url === 'https://raw.githubusercontent.com/acme/demo/HEAD/package.json') {
      return {
        ok: true,
        status: 200,
        text: async () => '{"name":"demo","dependencies":{"react":"^19.0.0"}}',
      }
    }

    return { ok: false, status: 404, text: async () => 'Not found' }
  }

  const snapshot = await fetchGithubProjectSnapshot('https://github.com/acme/demo', {
    fetchImpl,
  })

  assert.match(snapshot.text, /Repo: acme\/demo/)
  assert.match(snapshot.text, /README/)
  assert.match(snapshot.text, /React/)
  assert.match(snapshot.text, /package\.json/)
  assert.equal(snapshot.error, null)
  assert.ok(calls.some((call) => call.url.includes('/repos/acme/demo/readme')))
})

test('fetchGithubProjectSnapshot surfaces private or missing repos', async () => {
  const snapshot = await fetchGithubProjectSnapshot('https://github.com/private/hidden', {
    fetchImpl: async (url) => {
      if (url.endsWith('/private/hidden')) {
        return { ok: false, status: 404, text: async () => 'Not Found' }
      }

      return { ok: false, status: 404, text: async () => 'Not Found' }
    },
  })

  assert.equal(snapshot.text, '')
  assert.match(snapshot.error, /not found|private/i)
})
