export const defaultEmbedProvider = process.env.SWINLEARN_EMBED_PROVIDER || 'ollama'
export const defaultOllamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
export const defaultEmbedBatchSize = Number(process.env.SWINLEARN_EMBED_BATCH_SIZE || 32)
export const defaultGeminiEmbedBatchSize = Number(process.env.SWINLEARN_GEMINI_EMBED_BATCH_SIZE || 100)
export const defaultGeminiMaxBatchSize = Number(process.env.SWINLEARN_GEMINI_MAX_BATCH_SIZE || 100)
export const defaultGeminiEmbedBatchDelayMs = 1500
export const defaultOllamaEmbedBatchDelayMs = 0
export const defaultGeminiEmbedModel = 'gemini-embedding-001'
export const defaultOllamaEmbedModel = 'nomic-embed-text'
export const defaultEmbedModel =
  process.env.SWINLEARN_EMBED_MODEL ||
  (defaultEmbedProvider === 'gemini' ? defaultGeminiEmbedModel : defaultOllamaEmbedModel)
export const defaultEmbedDimensions = Number(process.env.SWINLEARN_EMBED_DIMS || 768)

const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta'
const maxRetries = 3
const geminiMaxRetries = 5
const retryableStatusCodes = new Set([429, 502, 503])

const ollamaTaskPrefix = {
  RETRIEVAL_DOCUMENT: 'search_document: ',
  RETRIEVAL_QUERY: 'search_query: ',
}

export function resolveEmbedBatchSize(
  provider = defaultEmbedProvider,
  {
    embedBatchSizeFromEnv = process.env.SWINLEARN_EMBED_BATCH_SIZE,
    geminiEmbedBatchSizeFromEnv = process.env.SWINLEARN_GEMINI_EMBED_BATCH_SIZE,
    geminiMaxBatchSizeFromEnv = process.env.SWINLEARN_GEMINI_MAX_BATCH_SIZE,
  } = {},
) {
  const parseBatchSize = (value, fallback) => {
    const parsed = Number(value)

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  if (provider === 'gemini') {
    const geminiBatch =
      geminiEmbedBatchSizeFromEnv !== undefined && geminiEmbedBatchSizeFromEnv !== ''
        ? parseBatchSize(geminiEmbedBatchSizeFromEnv, 100)
        : embedBatchSizeFromEnv !== undefined && embedBatchSizeFromEnv !== ''
          ? parseBatchSize(embedBatchSizeFromEnv, 100)
          : 100
    const maxBatch =
      geminiMaxBatchSizeFromEnv !== undefined && geminiMaxBatchSizeFromEnv !== ''
        ? parseBatchSize(geminiMaxBatchSizeFromEnv, 100)
        : 100

    return Math.min(Math.max(1, geminiBatch), Math.max(1, maxBatch))
  }

  const ollamaBatch =
    embedBatchSizeFromEnv !== undefined && embedBatchSizeFromEnv !== ''
      ? parseBatchSize(embedBatchSizeFromEnv, 32)
      : 32

  return Math.max(1, ollamaBatch)
}

export function resolveEmbedBatchDelayMs(
  provider = defaultEmbedProvider,
  { delayMsFromEnv = process.env.SWINLEARN_EMBED_BATCH_DELAY_MS } = {},
) {
  if (delayMsFromEnv !== undefined && delayMsFromEnv !== '') {
    const parsed = Number(delayMsFromEnv)

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }

  if (provider === 'gemini') {
    return defaultGeminiEmbedBatchDelayMs
  }

  return defaultOllamaEmbedBatchDelayMs
}

export function l2Normalize(vector) {
  const values = vector.map((value) => Number(value))
  const magnitude = Math.hypot(...values)

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return values
  }

  return values.map((value) => value / magnitude)
}

function prefixTextsForOllama(texts, taskType) {
  const prefix = ollamaTaskPrefix[taskType] ?? ollamaTaskPrefix.RETRIEVAL_DOCUMENT

  return texts.map((text) => `${prefix}${text}`)
}

export async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function chunkArray(items, batchSize) {
  const safeBatchSize = Math.max(1, batchSize)
  const batches = []

  for (let index = 0; index < items.length; index += safeBatchSize) {
    batches.push(items.slice(index, index + safeBatchSize))
  }

  return batches
}

function parseRetryAfterMs(response) {
  const header = response.headers?.get?.('retry-after')

  if (!header) {
    return null
  }

  const seconds = Number(header)

  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000
  }

  return null
}

async function fetchWithRetry(fetchImpl, url, options, {
  label = 'Embedding',
  maxAttempts = maxRetries,
  rateLimitBackoffMs = 5000,
  retryBackoffBaseMs = 250,
} = {}) {
  let lastError = null
  let lastResponse = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, options)
      lastResponse = response

      if (response.ok || !retryableStatusCodes.has(response.status)) {
        return response
      }

      lastError = new Error(`${label} request failed with status ${response.status}.`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`${label} request failed.`)
    }

    if (attempt < maxAttempts - 1) {
      const retryAfterMs = lastResponse ? parseRetryAfterMs(lastResponse) : null
      const isRateLimited = lastResponse?.status === 429

      await sleep(
        retryAfterMs ?? (isRateLimited ? rateLimitBackoffMs : retryBackoffBaseMs * 2 ** attempt),
      )
    }
  }

  throw lastError ?? new Error(`${label} request failed.`)
}

async function geminiEmbedBatch({
  apiKey,
  dimensions,
  fetchImpl,
  model,
  taskType,
  texts,
}) {
  const response = await fetchWithRetry(
    fetchImpl,
    `${geminiApiBase}/models/${model}:batchEmbedContents`,
    {
      body: JSON.stringify({
        requests: texts.map((text) => ({
          content: {
            parts: [{ text: String(text) }],
          },
          model: `models/${model}`,
          outputDimensionality: dimensions,
          taskType,
        })),
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      method: 'POST',
    },
    { label: 'Gemini embedding', maxAttempts: geminiMaxRetries, rateLimitBackoffMs: Math.max(resolveEmbedBatchDelayMs('gemini'), 5000) },
  )
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'Gemini embedding request failed.')
  }

  return (data?.embeddings ?? []).map((entry) => l2Normalize(entry.values ?? []))
}

async function ollamaEmbedBatch({
  dimensions,
  fetchImpl,
  model,
  taskType,
  texts,
  url,
}) {
  const response = await fetchWithRetry(fetchImpl, `${url.replace(/\/$/, '')}/api/embed`, {
    body: JSON.stringify({
      dimensions,
      input: prefixTextsForOllama(texts, taskType),
      model,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  }, { label: 'Ollama embedding' })
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null

  if (!response.ok) {
    throw new Error(data?.error || 'Ollama embedding request failed.')
  }

  return (data?.embeddings ?? []).map((entry) => l2Normalize(entry))
}

export function createGeminiEmbedder({
  apiKey = process.env.GEMINI_API_KEY,
  dimensions = defaultEmbedDimensions,
  fetchImpl = fetch,
  maxBatchSize = defaultGeminiMaxBatchSize,
  model = defaultEmbedModel,
} = {}) {
  if (!apiKey) {
    return {
      configured: false,
      async embed() {
        throw new Error('Gemini embedder is not configured.')
      },
    }
  }

  const safeMaxBatchSize = Math.max(1, maxBatchSize)

  return {
    configured: true,
    async embed(texts, { taskType = 'RETRIEVAL_DOCUMENT' } = {}) {
      const normalizedTexts = texts.map((text) => String(text ?? '').trim()).filter(Boolean)

      if (normalizedTexts.length === 0) {
        return []
      }

      const batches = chunkArray(normalizedTexts, safeMaxBatchSize)
      const vectors = []
      const batchDelayMs = resolveEmbedBatchDelayMs('gemini')
      let batchIndex = 0

      for (const batch of batches) {
        const batchVectors = await geminiEmbedBatch({
          apiKey,
          dimensions,
          fetchImpl,
          model,
          taskType,
          texts: batch,
        })

        vectors.push(...batchVectors)

        if (batchDelayMs > 0 && batchIndex < batches.length - 1) {
          await sleep(batchDelayMs)
        }

        batchIndex += 1
      }

      return vectors
    },
  }
}

export function createOllamaEmbedder({
  batchSize = defaultEmbedBatchSize,
  dimensions = defaultEmbedDimensions,
  fetchImpl = fetch,
  model = defaultEmbedModel,
  url = defaultOllamaUrl,
} = {}) {
  if (!url) {
    return {
      configured: false,
      async embed() {
        throw new Error('Ollama embedder is not configured.')
      },
    }
  }

  return {
    configured: true,
    async embed(texts, { taskType = 'RETRIEVAL_DOCUMENT' } = {}) {
      const normalizedTexts = texts.map((text) => String(text ?? '').trim()).filter(Boolean)

      if (normalizedTexts.length === 0) {
        return []
      }

      const safeBatchSize = Math.max(1, batchSize)
      const batches = chunkArray(normalizedTexts, safeBatchSize)
      const vectors = []

      for (const batch of batches) {
        const batchVectors = await ollamaEmbedBatch({
          dimensions,
          fetchImpl,
          model,
          taskType,
          texts: batch,
          url,
        })

        vectors.push(...batchVectors)
      }

      return vectors
    },
  }
}

export function createEmbedder({
  provider = defaultEmbedProvider,
  ...options
} = {}) {
  if (provider === 'gemini') {
    return createGeminiEmbedder(options)
  }

  return createOllamaEmbedder(options)
}
