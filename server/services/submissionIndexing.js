import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { chunkArray, resolveEmbedBatchDelayMs, resolveEmbedBatchSize, sleep } from './embeddings.js'
import { htmlToPlainText } from './courseContentImport.js'
import { fetchGithubProjectSnapshot, parseGithubRepoUrl } from './githubProjectSnapshot.js'
import { parseStudyDocumentFile } from './swinlearnFiles.js'
import { chunkText } from './textChunker.js'
import { buildSubmissionDeleteFilter } from './vectorStore.js'

const submissionFileExtensions = new Set([
  '.doc',
  '.docx',
  '.html',
  '.md',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rtf',
  '.txt',
  '.xlsx',
])

const readableTextExtensions = new Set(['.html', '.md', '.txt'])

export async function readSubmissionFileText(filePath) {
  const extension = path.extname(String(filePath ?? '')).toLowerCase()

  if (!submissionFileExtensions.has(extension)) {
    return ''
  }

  try {
    if (readableTextExtensions.has(extension)) {
      const rawText = await readFile(filePath, 'utf8')
      return extension === '.html' ? htmlToPlainText(rawText) : rawText.trim()
    }

    return await parseStudyDocumentFile(filePath, extension)
  } catch {
    return ''
  }
}

export async function buildSubmissionSegments({
  assignment,
  fetchGithub = fetchGithubProjectSnapshot,
  offering,
  submission,
}) {
  const courseCode = offering?.course?.code ?? 'Course'
  const label = `${courseCode} - ${offering?.course?.title ?? 'Course'}`
  const lines = [`Assignment submission: ${assignment.title}`]

  if (String(submission.body ?? '').trim()) {
    lines.push('Student response:', String(submission.body).trim())
  }

  for (const filePath of Array.isArray(submission.filePaths) ? submission.filePaths : []) {
    const fileText = await readSubmissionFileText(filePath)

    if (fileText.trim()) {
      lines.push(`Submitted file: ${path.basename(filePath)}`, fileText.trim())
    }
  }

  const github = parseGithubRepoUrl(submission.body)

  if (github) {
    const snapshot = await fetchGithub(github.url)

    if (snapshot.text.trim()) {
      lines.push(`GitHub project: ${github.url}`, snapshot.text.trim())
    }
  }

  if (lines.length === 1) {
    return { error: 'No readable submission text, files, or GitHub README were found.', segments: [] }
  }

  return {
    error: null,
    segments: [
      {
        locator: {
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          courseCode,
          githubUrl: github?.url ?? null,
          offeringId: assignment.offeringId,
          studentId: submission.studentId,
        },
        text: [`Course: ${label}`, ...lines].join('\n'),
        title: github
          ? `${label} / My project / ${github.owner}/${github.repo}`
          : `${label} / My submission / ${assignment.title}`,
      },
    ],
  }
}

export function buildSubmissionChunkRecords(segments) {
  const records = []

  for (const segment of segments) {
    for (const chunk of chunkText(segment.text)) {
      records.push({
        ...segment.locator,
        chunkIndex: chunk.chunkIndex,
        source: 'submission',
        text: chunk.text,
        title: segment.title,
      })
    }
  }

  return records
}

export async function indexAssignmentSubmission({
  assignment,
  batchDelayMs = resolveEmbedBatchDelayMs(),
  batchSize = resolveEmbedBatchSize(),
  embedder,
  fetchGithub = fetchGithubProjectSnapshot,
  offering,
  prisma,
  studentId,
  submission,
  vectorStore,
}) {
  if (!embedder?.configured || !vectorStore?.configured) {
    return prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        githubUrl: parseGithubRepoUrl(submission.body)?.url ?? null,
        indexError: null,
        indexStatus: 'skipped',
        indexedAt: null,
      },
    })
  }

  const { error, segments } = await buildSubmissionSegments({
    assignment,
    fetchGithub,
    offering,
    submission,
  })

  await vectorStore.deleteByFilter(
    buildSubmissionDeleteFilter({
      assignmentId: assignment.id,
      studentId,
    }),
  )

  if (segments.length === 0) {
    return prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        githubUrl: parseGithubRepoUrl(submission.body)?.url ?? null,
        indexError: error,
        indexStatus: 'skipped',
        indexedAt: null,
      },
    })
  }

  const records = buildSubmissionChunkRecords(segments)
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

  return prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: {
      githubUrl: parseGithubRepoUrl(submission.body)?.url ?? null,
      indexError: null,
      indexStatus: 'ready',
      indexedAt: new Date(),
    },
  })
}

export async function loadStudentSubmissionDocuments({
  maxChars = 6000,
  offeringIds = [],
  prisma,
  studentId,
}) {
  if (!studentId || offeringIds.length === 0) {
    return []
  }

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      studentId,
      assignment: {
        offeringId: {
          in: offeringIds,
        },
      },
    },
    include: {
      assignment: {
        include: {
          offering: {
            include: {
              course: true,
            },
          },
        },
      },
    },
    orderBy: {
      submittedAt: 'desc',
    },
  })

  const documents = []
  let remaining = maxChars

  for (const submission of submissions) {
    const { segments } = await buildSubmissionSegments({
      assignment: submission.assignment,
      fetchGithub: async () => ({ error: null, text: '' }),
      offering: submission.assignment.offering,
      submission,
    })

    for (const segment of segments) {
      const text = String(segment.text ?? '').slice(0, remaining)

      if (!text.trim()) {
        continue
      }

      documents.push({
        id: `submission:${submission.id}`,
        source: 'submission',
        text,
        title: segment.title,
      })
      remaining -= text.length

      if (remaining <= 0) {
        return documents
      }
    }
  }

  return documents
}
