import { QdrantClient } from '@qdrant/js-client-rest'

import { defaultEmbedDimensions } from './embeddings.js'

export const defaultCollectionName = 'swinlearn_chunks'

export function buildCourseFilter(offeringIds = []) {
  return {
    must: [
      { key: 'source', match: { value: 'course' } },
      { key: 'offeringId', match: { any: offeringIds } },
    ],
  }
}

export function buildUploadFilter(threadId, userId) {
  return {
    must: [
      { key: 'source', match: { value: 'upload' } },
      { key: 'threadId', match: { value: threadId } },
      { key: 'userId', match: { value: userId } },
    ],
  }
}

export function buildRetrievalFilter({ offeringIds = [], threadId, userId } = {}) {
  const filters = []

  if (offeringIds.length > 0) {
    filters.push(buildCourseFilter(offeringIds))
  }

  if (threadId && userId) {
    filters.push(buildUploadFilter(threadId, userId))
  }

  if (filters.length === 1) {
    return filters[0]
  }

  return { should: filters }
}

export function buildOfferingDeleteFilter(offeringId) {
  return {
    must: [
      { key: 'source', match: { value: 'course' } },
      { key: 'offeringId', match: { value: offeringId } },
    ],
  }
}

export function buildAttachmentDeleteFilter(attachmentId) {
  return {
    must: [
      { key: 'source', match: { value: 'upload' } },
      { key: 'attachmentId', match: { value: attachmentId } },
    ],
  }
}

export function buildThreadDeleteFilter(threadId) {
  return {
    must: [
      { key: 'source', match: { value: 'upload' } },
      { key: 'threadId', match: { value: threadId } },
    ],
  }
}

export function mapSearchResultToDocument(result) {
  const payload = result?.payload ?? {}

  return {
    courseCode: payload.courseCode ?? null,
    id: String(result?.id ?? ''),
    locator: {
      assignmentTitle: payload.assignmentTitle ?? null,
      attachmentId: payload.attachmentId ?? null,
      chunkIndex: payload.chunkIndex ?? null,
      itemTitle: payload.itemTitle ?? null,
      messageId: payload.messageId ?? null,
      moduleTitle: payload.moduleTitle ?? null,
      offeringId: payload.offeringId ?? null,
      packageId: payload.packageId ?? null,
      threadId: payload.threadId ?? null,
      userId: payload.userId ?? null,
    },
    score: result?.score ?? null,
    source: payload.source ?? 'course',
    text: String(payload.text ?? ''),
    title: String(payload.title ?? 'Study source'),
  }
}

export function createVectorStore({
  apiKey = process.env.QDRANT_API_KEY,
  clientFactory,
  collectionName = defaultCollectionName,
  url = process.env.QDRANT_URL,
  vectorSize = defaultEmbedDimensions,
} = {}) {
  if (!url) {
    return {
      collectionName,
      configured: false,
      async ensureCollection() {
        throw new Error('Vector store is not configured.')
      },
      async upsert() {
        throw new Error('Vector store is not configured.')
      },
      async search() {
        throw new Error('Vector store is not configured.')
      },
      async deleteByFilter() {
        throw new Error('Vector store is not configured.')
      },
    }
  }

  const client =
    clientFactory?.() ??
    new QdrantClient({
      apiKey: apiKey || undefined,
      url,
    })

  let collectionReady = false

  return {
    collectionName,
    configured: true,
    async ensureCollection() {
      if (collectionReady) {
        return
      }

      const existing = await client.collectionExists(collectionName)

      if (!existing?.exists) {
        await client.createCollection(collectionName, {
          vectors: {
            distance: 'Cosine',
            size: vectorSize,
          },
        })
      }

      collectionReady = true
    },
    async upsert(points) {
      if (!points?.length) {
        return
      }

      await this.ensureCollection()
      await client.upsert(collectionName, {
        points,
        wait: true,
      })
    },
    async search({ filter, limit = 8, scoreThreshold, vector }) {
      await this.ensureCollection()
      const results = await client.search(collectionName, {
        filter,
        limit,
        score_threshold: scoreThreshold,
        vector,
        with_payload: true,
      })

      return results.map(mapSearchResultToDocument)
    },
    async deleteByFilter(filter) {
      if (!filter) {
        return
      }

      await this.ensureCollection()
      await client.delete(collectionName, {
        filter,
        wait: true,
      })
    },
  }
}
