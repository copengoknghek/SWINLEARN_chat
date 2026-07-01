import { readFile } from 'node:fs/promises'

export const defaultSwinlearnModel = process.env.SWINLEARN_GROQ_MODEL || 'llama-3.1-8b-instant'
export const defaultSwinlearnVisionModel =
  process.env.SWINLEARN_GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'
export const defaultSwinlearnContextChars = Number(process.env.SWINLEARN_GROQ_CONTEXT_CHARS || 12000)

const apiBaseUrl = 'https://api.groq.com/openai/v1'

const trimText = (value, maxChars = defaultSwinlearnContextChars) => {
  const text = String(value ?? '').trim()

  return text.length > maxChars ? `${text.slice(0, maxChars).trim()}\n[Source truncated]` : text
}

const documentContext = (documents = []) =>
  documents
    .filter((document) => document?.text)
    .map((document, index) =>
      [
        `[${index + 1}] ${document.title ?? 'Study source'}`,
        document.courseCode ? `Course code: ${document.courseCode}` : '',
        `Source type: ${document.source ?? 'course'}`,
        trimText(document.text),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n---\n\n')

export function buildSwinlearnGroqPayload({
  documents = [],
  history = [],
  imageInputs = [],
  instructions,
  message,
  model = defaultSwinlearnModel,
}) {
  const context = documentContext(documents)
  const userText = [
    String(message ?? ''),
    context
      ? [
          'Prior chat messages are context only. For factual course content, use ONLY the sources below.',
          'Use only the enrolled-course and uploaded-file sources below when course knowledge is needed.',
          'Cite the source title and course code in your answer when helpful.',
          '',
          context,
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const messages = [
    {
      role: 'system',
      content: String(instructions ?? ''),
    },
    ...history.slice(-8).map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content,
    })),
  ]

  messages.push({
    role: 'user',
    content:
      imageInputs.length > 0
        ? [
            { type: 'text', text: userText },
            ...imageInputs.map((image) => ({
              type: 'image_url',
              image_url: { url: image.dataUrl },
            })),
          ]
        : userText,
  })

  return {
    messages,
    model,
    stream: false,
    temperature: 0.2,
  }
}

export function extractGroqAssistantText(response) {
  return response?.choices?.[0]?.message?.content?.trim() ?? ''
}

const groqCitations = (documents = []) =>
  documents
    .filter((document) => document?.text)
    .map((document) => ({
      file_id: document.id ?? null,
      filename: document.title ?? 'Study source',
      score: document.score ?? null,
      text: trimText(document.text, 240),
    }))

async function groqRequest({ apiKey, body, fetchImpl = fetch, path }) {
  const response = await fetchImpl(`${apiBaseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'Groq request failed.')
  }

  return data
}

export function createSwinlearnGroqClient({
  apiKey = process.env.GROQ_API_KEY,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) {
    return { configured: false }
  }

  return {
    configured: true,
    async createResponse(input) {
      const model = input.model ?? (input.imageInputs?.length ? defaultSwinlearnVisionModel : defaultSwinlearnModel)
      const response = await groqRequest({
        apiKey,
        body: buildSwinlearnGroqPayload({
          ...input,
          model,
        }),
        fetchImpl,
        path: '/chat/completions',
      })

      return {
        citations: groqCitations(input.documents),
        raw: response,
        text: extractGroqAssistantText(response),
      }
    },
    async imageInputFromFile({ filePath, mimeType = 'application/octet-stream' }) {
      const buffer = await readFile(filePath)

      return {
        dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      }
    },
  }
}
