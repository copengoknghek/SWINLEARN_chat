import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEmbedder,
  createGeminiEmbedder,
  createOllamaEmbedder,
  chunkArray,
  l2Normalize,
  resolveEmbedBatchSize,
  resolveEmbedBatchDelayMs,
} from './embeddings.js'

test('l2Normalize scales vectors to unit length', () => {
  const normalized = l2Normalize([3, 4])

  assert.ok(Math.abs(normalized[0] - 0.6) < 0.0001)
  assert.ok(Math.abs(normalized[1] - 0.8) < 0.0001)
})

test('createGeminiEmbedder returns unconfigured when api key is missing', async () => {
  const embedder = createGeminiEmbedder({ apiKey: '' })

  assert.equal(embedder.configured, false)
  await assert.rejects(() => embedder.embed(['hello']), /not configured/i)
})

test('createGeminiEmbedder calls Gemini batchEmbedContents with taskType and dimensions', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          embeddings: [
            { values: [3, 4] },
            { values: [0, 5] },
          ],
        })
      },
    }
  }

  const embedder = createGeminiEmbedder({
    apiKey: 'test-key',
    dimensions: 768,
    fetchImpl,
    model: 'gemini-embedding-001',
  })
  const vectors = await embedder.embed(['first text', 'second text'], {
    taskType: 'RETRIEVAL_DOCUMENT',
  })

  assert.equal(embedder.configured, true)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /gemini-embedding-001:batchEmbedContents/)
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key')

  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.requests.length, 2)
  assert.equal(body.requests[0].taskType, 'RETRIEVAL_DOCUMENT')
  assert.equal(body.requests[0].outputDimensionality, 768)
  assert.equal(body.requests[0].content.parts[0].text, 'first text')
  assert.equal(vectors.length, 2)
  assert.ok(Math.abs(Math.hypot(...vectors[0]) - 1) < 0.0001)
  assert.ok(Math.abs(Math.hypot(...vectors[1]) - 1) < 0.0001)
})

test('resolveEmbedBatchSize returns 100 for gemini and 32 for ollama by default', () => {
  assert.equal(
    resolveEmbedBatchSize('gemini', {
      embedBatchSizeFromEnv: undefined,
      geminiEmbedBatchSizeFromEnv: undefined,
      geminiMaxBatchSizeFromEnv: undefined,
    }),
    100,
  )
  assert.equal(
    resolveEmbedBatchSize('ollama', { embedBatchSizeFromEnv: undefined }),
    32,
  )
})

test('resolveEmbedBatchSize uses SWINLEARN_EMBED_BATCH_SIZE for gemini when gemini-specific env is unset', () => {
  assert.equal(
    resolveEmbedBatchSize('gemini', {
      embedBatchSizeFromEnv: '16',
      geminiEmbedBatchSizeFromEnv: undefined,
      geminiMaxBatchSizeFromEnv: '100',
    }),
    16,
  )
})

test('resolveEmbedBatchSize prefers SWINLEARN_GEMINI_EMBED_BATCH_SIZE over shared batch size', () => {
  assert.equal(
    resolveEmbedBatchSize('gemini', {
      embedBatchSizeFromEnv: '16',
      geminiEmbedBatchSizeFromEnv: '24',
      geminiMaxBatchSizeFromEnv: '100',
    }),
    24,
  )
})

test('resolveEmbedBatchDelayMs uses smart defaults when env is unset', () => {
  assert.equal(resolveEmbedBatchDelayMs('gemini', { delayMsFromEnv: undefined }), 1500)
  assert.equal(resolveEmbedBatchDelayMs('ollama', { delayMsFromEnv: undefined }), 0)
})

test('resolveEmbedBatchDelayMs prefers SWINLEARN_EMBED_BATCH_DELAY_MS when set', () => {
  assert.equal(resolveEmbedBatchDelayMs('gemini', { delayMsFromEnv: '500' }), 500)
  assert.equal(resolveEmbedBatchDelayMs('ollama', { delayMsFromEnv: '2500' }), 2500)
})

test('resolveEmbedBatchDelayMs treats blank env as unset', () => {
  assert.equal(resolveEmbedBatchDelayMs('gemini', { delayMsFromEnv: '' }), 1500)
})

test('chunkArray splits items into sequential batches', () => {
  assert.deepEqual(chunkArray(['a', 'b', 'c', 'd', 'e'], 2), [['a', 'b'], ['c', 'd'], ['e']])
})

test('createGeminiEmbedder processes API batches sequentially with delay between calls', async () => {
  const callTimes = []
  const fetchImpl = async (_url, options) => {
    callTimes.push(Date.now())
    const body = JSON.parse(options.body)
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          embeddings: Array.from({ length: body.requests.length }, () => ({ values: [1, 0] })),
        })
      },
    }
  }

  const embedder = createGeminiEmbedder({
    apiKey: 'test-key',
    dimensions: 2,
    fetchImpl,
    maxBatchSize: 2,
  })

  const originalDelay = process.env.SWINLEARN_EMBED_BATCH_DELAY_MS
  process.env.SWINLEARN_EMBED_BATCH_DELAY_MS = '40'

  try {
    await embedder.embed(['a', 'b', 'c', 'd', 'e'])
  } finally {
    if (originalDelay === undefined) {
      delete process.env.SWINLEARN_EMBED_BATCH_DELAY_MS
    } else {
      process.env.SWINLEARN_EMBED_BATCH_DELAY_MS = originalDelay
    }
  }

  assert.equal(callTimes.length, 3)
  assert.ok(callTimes[1] - callTimes[0] >= 35)
  assert.ok(callTimes[2] - callTimes[1] >= 35)
})

test('createGeminiEmbedder respects maxBatchSize option', async () => {
  let callCount = 0
  const fetchImpl = async (_url, options) => {
    callCount += 1
    const body = JSON.parse(options.body)
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          embeddings: Array.from({ length: body.requests.length }, () => ({ values: [1, 0] })),
        })
      },
    }
  }

  const embedder = createGeminiEmbedder({
    apiKey: 'test-key',
    dimensions: 2,
    fetchImpl,
    maxBatchSize: 50,
  })
  const texts = Array.from({ length: 120 }, (_, index) => `text-${index}`)
  const vectors = await embedder.embed(texts)

  assert.equal(callCount, 3)
  assert.equal(vectors.length, 120)
})

test('createGeminiEmbedder retries transient 429 failures', async () => {
  let callCount = 0
  const fetchImpl = async () => {
    callCount += 1

    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: {
          get() {
            return null
          },
        },
        async text() {
          return JSON.stringify({
            error: { message: 'RESOURCE_EXHAUSTED: quota exceeded' },
          })
        },
      }
    }

    return {
      ok: true,
      headers: {
        get() {
          return null
        },
      },
      async text() {
        return JSON.stringify({
          embeddings: [{ values: [3, 4] }],
        })
      },
    }
  }

  const embedder = createGeminiEmbedder({
    apiKey: 'test-key',
    dimensions: 2,
    fetchImpl,
  })
  const vectors = await embedder.embed(['hello'])

  assert.equal(callCount, 2)
  assert.equal(vectors.length, 1)
})

test('createGeminiEmbedder honors Retry-After header on 429', async () => {
  const delays = []
  let callCount = 0
  const originalSetTimeout = globalThis.setTimeout

  globalThis.setTimeout = (callback, ms) => {
    delays.push(ms)
    return originalSetTimeout(callback, 0)
  }

  try {
    const fetchImpl = async () => {
      callCount += 1

      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: {
            get(name) {
              return name.toLowerCase() === 'retry-after' ? '2' : null
            },
          },
          async text() {
            return JSON.stringify({
              error: { message: 'RESOURCE_EXHAUSTED' },
            })
          },
        }
      }

      return {
        ok: true,
        headers: {
          get() {
            return null
          },
        },
        async text() {
          return JSON.stringify({
            embeddings: [{ values: [1, 0] }],
          })
        },
      }
    }

    const embedder = createGeminiEmbedder({
      apiKey: 'test-key',
      dimensions: 2,
      fetchImpl,
    })
    await embedder.embed(['hello'])

    assert.equal(callCount, 2)
    assert.equal(delays[0], 2000)
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }
})

test('createGeminiEmbedder batches more than 100 texts', async () => {
  let callCount = 0
  const fetchImpl = async (_url, options) => {
    callCount += 1
    const body = JSON.parse(options.body)
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          embeddings: Array.from({ length: body.requests.length }, () => ({ values: [1, 0] })),
        })
      },
    }
  }

  const embedder = createGeminiEmbedder({
    apiKey: 'test-key',
    dimensions: 2,
    fetchImpl,
  })
  const texts = Array.from({ length: 150 }, (_, index) => `text-${index}`)
  const vectors = await embedder.embed(texts)

  assert.equal(callCount, 2)
  assert.equal(vectors.length, 150)
})

test('createOllamaEmbedder returns unconfigured when url is missing', async () => {
  const embedder = createOllamaEmbedder({ url: '' })

  assert.equal(embedder.configured, false)
  await assert.rejects(() => embedder.embed(['hello']), /not configured/i)
})

test('createOllamaEmbedder calls /api/embed with nomic prefixes and dimensions', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          embeddings: [
            [3, 4],
            [0, 5],
          ],
        })
      },
    }
  }

  const embedder = createOllamaEmbedder({
    dimensions: 768,
    fetchImpl,
    model: 'nomic-embed-text',
    url: 'http://ollama:11434',
  })
  const vectors = await embedder.embed(['first text', 'second text'], {
    taskType: 'RETRIEVAL_DOCUMENT',
  })

  assert.equal(embedder.configured, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://ollama:11434/api/embed')

  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.model, 'nomic-embed-text')
  assert.equal(body.dimensions, 768)
  assert.equal(body.input[0], 'search_document: first text')
  assert.equal(body.input[1], 'search_document: second text')
  assert.equal(vectors.length, 2)
  assert.ok(Math.abs(Math.hypot(...vectors[0]) - 1) < 0.0001)
})

test('createOllamaEmbedder prefixes queries with search_query', async () => {
  const calls = []
  const fetchImpl = async (_url, options) => {
    calls.push(JSON.parse(options.body))
    return {
      ok: true,
      async text() {
        return JSON.stringify({ embeddings: [[1, 0]] })
      },
    }
  }

  const embedder = createOllamaEmbedder({
    dimensions: 2,
    fetchImpl,
    model: 'nomic-embed-text',
    url: 'http://localhost:11434',
  })

  await embedder.embed(['what is ML?'], { taskType: 'RETRIEVAL_QUERY' })

  assert.equal(calls[0].input[0], 'search_query: what is ML?')
})

test('createOllamaEmbedder batches requests and retries transient failures', async () => {
  let callCount = 0
  const fetchImpl = async (_url, options) => {
    callCount += 1
    const body = JSON.parse(options.body)

    if (callCount === 1) {
      return {
        ok: false,
        status: 503,
        async text() {
          return JSON.stringify({ error: 'busy' })
        },
      }
    }

    return {
      ok: true,
      async text() {
        return JSON.stringify({
          embeddings: Array.from({ length: body.input.length }, () => [1, 0]),
        })
      },
    }
  }

  const embedder = createOllamaEmbedder({
    batchSize: 2,
    dimensions: 2,
    fetchImpl,
    model: 'nomic-embed-text',
    url: 'http://localhost:11434',
  })
  const vectors = await embedder.embed(['a', 'b', 'c'])

  assert.equal(callCount, 3)
  assert.equal(vectors.length, 3)
})

test('createEmbedder selects gemini when provider is gemini', () => {
  const embedder = createEmbedder({
    apiKey: '',
    provider: 'gemini',
  })

  assert.equal(embedder.configured, false)
})

test('createEmbedder selects ollama by default', () => {
  const embedder = createEmbedder({
    provider: 'ollama',
    url: 'http://localhost:11434',
  })

  assert.equal(embedder.configured, true)
})
