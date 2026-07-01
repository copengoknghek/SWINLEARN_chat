import assert from 'node:assert/strict'
import test from 'node:test'

import { createGeminiEmbedder, l2Normalize } from './embeddings.js'

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
