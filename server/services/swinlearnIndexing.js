import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { createEmbedder, chunkArray, resolveEmbedBatchDelayMs, resolveEmbedBatchSize, sleep } from './embeddings.js'
import { htmlToPlainText } from './courseContentImport.js'
import { indexStatusForPackage, loadOfferingKnowledge } from './swinlearnKnowledge.js'
import { extractUploadText, parseStudyDocumentFile } from './swinlearnFiles.js'
import { chunkText } from './textChunker.js'
import {
  buildCourseFilter,
  buildOfferingDeleteFilter,
  buildRetrievalFilter,
  buildSubmissionFilter,
  buildUploadFilter,
  createVectorStore,
  defaultCollectionName,
} from './vectorStore.js'

export const defaultRetrievalTopK = Number(process.env.SWINLEARN_RETRIEVAL_TOP_K || 3)

const courseLabel = (offering) => `${offering.course.code} - ${offering.course.title}`
const itemType = (item) => item.itemType ?? item.item_type ?? 'item'

const withCoursePrefix = (label, lines) => [`Course: ${label}`, ...lines].join('\n')

const officeAssetExtensions = new Set([
  '.doc',
  '.docx',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rtf',
  '.txt',
  '.xlsx',
])

export function createSwinlearnRagServices({
  embedder = createEmbedder(),
  vectorStore = createVectorStore(),
} = {}) {
  return {
    embedder,
    configured: Boolean(embedder.configured && vectorStore.configured),
    vectorStore,
  }
}

export function buildRetrievedCitations(documents = []) {
  return documents
    .filter((document) => document?.text)
    .map((document) => ({
      file_id: document.id ?? null,
      filename: document.title ?? 'Study source',
      score: document.score ?? null,
      text: String(document.text).slice(0, 240),
    }))
}

export async function readAssetText(asset, options = {}) {
  const extension = path.extname(String(asset.title ?? asset.sourcePath ?? '')).toLowerCase()

  if (!officeAssetExtensions.has(extension)) {
    return ''
  }

  try {
    return await parseStudyDocumentFile(asset.storedPath, extension, options)
  } catch {
    return ''
  }
}

export async function buildOfferingSegments(offering, options = {}) {
  const contentPackage = offering.contentPackages?.[0] ?? null
  const label = courseLabel(offering)
  const segments = [
    {
      locator: {
        courseCode: offering.course.code,
        offeringId: offering.id,
        packageId: contentPackage?.id ?? null,
      },
      text: [
        `Course: ${label}`,
        `Term: ${String(offering.term ?? '').replace('_', ' ')} ${offering.academicYear}`,
        `Description: ${offering.course.description || 'No description provided.'}`,
        contentPackage
          ? `Imported package: ${contentPackage.sourceTitle ?? contentPackage.source_title ?? 'Course content'}`
          : 'No imported course knowledge package is available yet.',
      ].join('\n'),
      title: label,
    },
  ]

  if (contentPackage) {
    for (const module of contentPackage.modules ?? []) {
      for (const item of module.items ?? []) {
        const plainText = htmlToPlainText(item.contentHtml ?? item.content_html ?? '')
        const asset = item.asset
        const lines = [`${item.title} (${itemType(item)})`]

        if (plainText) {
          lines.push(plainText)
        }

        if (asset) {
          lines.push(`File: ${asset.title}`)
          const assetText = await readAssetText(asset, options)

          if (assetText) {
            lines.push(assetText)
          }
        }

        if (lines.length > 1) {
          segments.push({
            locator: {
              courseCode: offering.course.code,
              itemTitle: item.title,
              moduleTitle: module.title,
              offeringId: offering.id,
              packageId: contentPackage.id,
            },
            text: withCoursePrefix(label, lines),
            title: `${label} / ${module.title} / ${item.title}`,
          })
        }
      }
    }

    for (const asset of contentPackage.assets ?? []) {
      const assetText = await readAssetText(asset, options)

      if (!assetText) {
        continue
      }

      segments.push({
        locator: {
          courseCode: offering.course.code,
          offeringId: offering.id,
          packageId: contentPackage.id,
        },
        text: withCoursePrefix(label, [`Course file: ${asset.title}`, assetText]),
        title: `${label} / ${asset.title}`,
      })
    }
  }

  for (const assignment of offering.assignments ?? []) {
    const plainText = htmlToPlainText(
      assignment.contentHtml ?? assignment.content_html ?? assignment.description ?? '',
    )
    const dueAt = assignment.dueAt ?? assignment.due_at
    const points = assignment.pointsPossible ?? assignment.points_possible
    const lines = [`Assignment: ${assignment.title}`]

    if (dueAt) {
      lines.push(`Due: ${new Date(dueAt).toISOString()}`)
    }

    if (points !== null && points !== undefined) {
      lines.push(`Points: ${points}`)
    }

    if (plainText) {
      lines.push(plainText)
    }

    segments.push({
      locator: {
        assignmentTitle: assignment.title,
        courseCode: offering.course.code,
        offeringId: offering.id,
        packageId: contentPackage?.id ?? null,
      },
      text: withCoursePrefix(label, lines),
      title: `${label} / Assignment / ${assignment.title}`,
    })
  }

  return segments.filter((segment) => String(segment.text ?? '').trim())
}

export function buildChunkRecords(segments) {
  const records = []

  for (const segment of segments) {
    for (const chunk of chunkText(segment.text)) {
      records.push({
        ...segment.locator,
        chunkIndex: chunk.chunkIndex,
        source: 'course',
        text: chunk.text,
        title: segment.title,
      })
    }
  }

  return records
}

export async function indexOffering({
  batchDelayMs = resolveEmbedBatchDelayMs(),
  batchSize = resolveEmbedBatchSize(),
  embedder,
  offeringId,
  prisma,
  vectorStore,
}) {
  const offering = await loadOfferingKnowledge(prisma, offeringId)

  if (!offering) {
    return null
  }

  const contentPackage = offering.contentPackages[0] ?? null
  const currentPackageId = contentPackage?.id ?? null

  await prisma.swinlearnKnowledgeIndex.upsert({
    where: { offeringId },
    update: {
      errorMessage: null,
      packageId: currentPackageId,
      status: 'indexing',
      updatedAt: new Date(),
    },
    create: {
      offeringId,
      packageId: currentPackageId,
      status: 'indexing',
    },
  })

  try {
    const segments = await buildOfferingSegments(offering)
    const records = buildChunkRecords(segments)

    await vectorStore.deleteByFilter(buildOfferingDeleteFilter(offeringId))

    if (records.length > 0) {
      const batches = chunkArray(records, batchSize)
      let batchIndex = 0

      for (const batch of batches) {
        const vectors = await embedder.embed(
          batch.map((record) => record.text),
          { taskType: 'RETRIEVAL_DOCUMENT' },
        )
        const points = batch.map((record, vectorIndex) => ({
          id: randomUUID(),
          payload: record,
          vector: vectors[vectorIndex],
        }))

        await vectorStore.upsert(points)

        if (batchDelayMs > 0 && batchIndex < batches.length - 1) {
          await sleep(batchDelayMs)
        }

        batchIndex += 1
      }
    }

    return prisma.swinlearnKnowledgeIndex.update({
      where: { offeringId },
      data: {
        errorMessage: null,
        indexedAt: new Date(),
        packageId: currentPackageId,
        status: 'ready',
        vectorStoreId: defaultCollectionName,
      },
    })
  } catch (error) {
    return prisma.swinlearnKnowledgeIndex.update({
      where: { offeringId },
      data: {
        errorMessage: error instanceof Error ? error.message : 'Indexing failed.',
        status: 'error',
        updatedAt: new Date(),
      },
    })
  }
}

export async function indexThreadUpload({
  attachment,
  embedder,
  file,
  messageId,
  prisma,
  threadId,
  userId,
  validation,
  vectorStore,
}) {
  const text = await extractUploadText(file, validation)

  if (!text) {
    return attachment
  }

  const records = buildChunkRecords([
    {
      locator: {
        attachmentId: attachment.id,
        messageId,
        threadId,
        userId,
      },
      text,
      title: attachment.originalName,
    },
  ]).map((record) => ({
    ...record,
    source: 'upload',
  }))

  if (records.length === 0) {
    return attachment
  }

  const vectors = await embedder.embed(
    records.map((record) => record.text),
    { taskType: 'RETRIEVAL_DOCUMENT' },
  )
  const points = records.map((record, index) => ({
    id: randomUUID(),
    payload: record,
    vector: vectors[index],
  }))

  await vectorStore.upsert(points)

  return prisma.swinlearnAttachment.update({
    where: { id: attachment.id },
    data: {
      supportedByFileSearch: true,
      vectorStoreId: defaultCollectionName,
    },
  })
}

export async function retrieve({
  embedder,
  offeringIds = [],
  query,
  threadId,
  topK = defaultRetrievalTopK,
  userId,
  vectorStore,
}) {
  const [queryVector] = await embedder.embed([query], { taskType: 'RETRIEVAL_QUERY' })

  if (!queryVector) {
    return []
  }

  if (offeringIds.length <= 1) {
    const filter = buildRetrievalFilter({ offeringIds, threadId, userId })

    return vectorStore.search({
      filter,
      limit: topK,
      vector: queryVector,
    })
  }

  const perCourseLimit = Math.max(1, Math.ceil(topK / offeringIds.length))
  const courseResults = []

  for (const offeringId of offeringIds) {
    const hits = await vectorStore.search({
      filter: buildCourseFilter([offeringId]),
      limit: perCourseLimit,
      vector: queryVector,
    })

    courseResults.push(...hits)
  }

  let uploadResults = []

  if (threadId && userId) {
    uploadResults = await vectorStore.search({
      filter: buildUploadFilter(threadId, userId),
      limit: Math.max(1, Math.floor(topK / 4)),
      vector: queryVector,
    })
  }

  let submissionResults = []

  if (userId && offeringIds.length > 0) {
    submissionResults = await vectorStore.search({
      filter: buildSubmissionFilter(userId, offeringIds),
      limit: Math.max(1, Math.floor(topK / 4)),
      vector: queryVector,
    })
  }

  return [...courseResults, ...uploadResults, ...submissionResults]
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .filter((document, index, all) => all.findIndex((item) => item.id === document.id) === index)
    .slice(0, topK)
}

export async function cleanupOfferingVectors({
  offeringIds = [],
  vectorStore = createVectorStore(),
} = {}) {
  if (!vectorStore.configured || offeringIds.length === 0) {
    return
  }

  for (const offeringId of offeringIds) {
    await vectorStore.deleteByFilter(buildOfferingDeleteFilter(offeringId))
  }
}

export async function ensureIndexedOfferings({
  embedder,
  force = false,
  offeringIds,
  prisma,
  vectorStore,
}) {
  const indexes = []

  for (const offeringId of offeringIds) {
    const offering = await loadOfferingKnowledge(prisma, offeringId)

    if (!offering) {
      continue
    }

    const contentPackage = offering.contentPackages[0] ?? null
    const status = indexStatusForPackage(
      offering.swinlearnKnowledgeIndex,
      contentPackage?.id ?? null,
      { requireVectors: true },
    )

    if (!force && status === 'ready' && offering.swinlearnKnowledgeIndex?.vectorStoreId) {
      indexes.push(offering.swinlearnKnowledgeIndex)
      continue
    }

    if (!force && status === 'error') {
      if (offering.swinlearnKnowledgeIndex) {
        indexes.push(offering.swinlearnKnowledgeIndex)
      }
      continue
    }

    const index = await indexOffering({
      embedder,
      offeringId,
      prisma,
      vectorStore,
    })

    if (index) {
      indexes.push(index)
    }
  }

  return indexes
}
