export const defaultChunkMaxChars = 1200
export const defaultChunkOverlap = 180

const paragraphBoundary = /\n{2,}/

export function chunkText(text, { maxChars = defaultChunkMaxChars, overlap = defaultChunkOverlap } = {}) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim()

  if (!normalized) {
    return []
  }

  if (normalized.length <= maxChars) {
    return [{ chunkIndex: 0, text: normalized }]
  }

  const paragraphs = normalized.split(paragraphBoundary).map((part) => part.trim()).filter(Boolean)
  const chunks = []
  let current = ''

  const pushChunk = () => {
    const trimmed = current.trim()

    if (!trimmed) {
      return
    }

    chunks.push({
      chunkIndex: chunks.length,
      text: trimmed,
    })
    current = overlap > 0 ? trimmed.slice(-overlap) : ''
  }

  for (const paragraph of paragraphs.length > 0 ? paragraphs : [normalized]) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph

    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) {
      pushChunk()
    }

    if (paragraph.length <= maxChars) {
      current = paragraph
      continue
    }

    for (let index = 0; index < paragraph.length; index += maxChars - overlap) {
      const slice = paragraph.slice(index, index + maxChars).trim()

      if (slice) {
        chunks.push({
          chunkIndex: chunks.length,
          text: slice,
        })
      }
    }

    current = ''
  }

  if (current.trim()) {
    pushChunk()
  }

  return chunks
}
