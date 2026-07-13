export const defaultEmbedModel = process.env.SWINLEARN_EMBED_MODEL || 'gemini-embedding-001'
export const defaultEmbedDimensions = Number(process.env.SWINLEARN_EMBED_DIMS || 768)
const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta'
const maxBatchSize = 100

export function l2Normalize(vector) {
  const values = vector.map((value) => Number(value))
  const magnitude = Math.hypot(...values)

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return values
  }

  return values.map((value) => value / magnitude)
}

async function geminiEmbedBatch({
  apiKey,
  dimensions,
  fetchImpl,
  model,
  taskType,
  texts,
}) {
  const response = await fetchImpl(
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
  )
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'Gemini embedding request failed.')
  }

  return (data?.embeddings ?? []).map((entry) => l2Normalize(entry.values ?? []))
}

export function createGeminiEmbedder({
  apiKey = process.env.GEMINI_API_KEY,
  dimensions = defaultEmbedDimensions,
  fetchImpl = fetch,
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

  return {
    configured: true,
    async embed(texts, { taskType = 'RETRIEVAL_DOCUMENT' } = {}) {
      const normalizedTexts = texts.map((text) => String(text ?? '').trim()).filter(Boolean)

      if (normalizedTexts.length === 0) {
        return []
      }

      const vectors = []

      for (let index = 0; index < normalizedTexts.length; index += maxBatchSize) {
        const batch = normalizedTexts.slice(index, index + maxBatchSize)
        const batchVectors = await geminiEmbedBatch({
          apiKey,
          dimensions,
          fetchImpl,
          model,
          taskType,
          texts: batch,
        })

        vectors.push(...batchVectors)
      }

      return vectors
    },
  }
}
