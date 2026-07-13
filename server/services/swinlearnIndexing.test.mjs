import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildChunkRecords,
  buildOfferingSegments,
  buildRetrievedCitations,
  ensureIndexedOfferings,
  retrieve,
} from './swinlearnIndexing.js'

const offering = {
  academicYear: 2026,
  assignments: [
    {
      contentHtml: '<p>Explain gradient descent.</p>',
      title: 'ML reflection',
    },
  ],
  course: {
    code: 'COS30049',
    description: 'Machine learning foundations.',
    title: 'Machine Learning',
  },
  contentPackages: [
    {
      id: 'package-1',
      assets: [],
      modules: [
        {
          items: [
            {
              asset: null,
              contentHtml: '<p>Models learn patterns from data.</p>',
              itemType: 'wiki_page',
              title: 'Intro page',
            },
          ],
          title: 'Week 1',
        },
      ],
      sourceTitle: 'Canvas export',
    },
  ],
  id: 'offering-1',
  term: 'semester_1',
}

test('buildOfferingSegments creates module and assignment segments', async () => {
  const segments = await buildOfferingSegments(offering)

  assert.ok(segments.length >= 3)
  assert.match(segments[0].text, /COS30049 - Machine Learning/)
  assert.ok(segments.some((segment) => segment.title.includes('Week 1 / Intro page')))
  assert.ok(segments.some((segment) => segment.locator.assignmentTitle === 'ML reflection'))
  assert.ok(segments.every((segment) => segment.text.startsWith('Course: COS30049 - Machine Learning')))
})

test('buildChunkRecords preserves locator metadata per chunk', () => {
  const records = buildChunkRecords([
    {
      locator: { offeringId: 'offering-1', packageId: 'package-1' },
      text: 'Short chunk',
      title: 'Week 1',
    },
  ])

  assert.equal(records.length, 1)
  assert.equal(records[0].source, 'course')
  assert.equal(records[0].offeringId, 'offering-1')
  assert.equal(records[0].title, 'Week 1')
})

test('buildRetrievedCitations includes similarity score', () => {
  const citations = buildRetrievedCitations([
    {
      id: 'point-1',
      score: 0.88,
      text: 'Retrieved chunk body',
      title: 'Week 1',
    },
  ])

  assert.equal(citations[0].file_id, 'point-1')
  assert.equal(citations[0].score, 0.88)
  assert.match(citations[0].text, /Retrieved chunk body/)
})

test('retrieve embeds the query and searches the vector store', async () => {
  const embedCalls = []
  const searchCalls = []
  const documents = await retrieve({
    embedder: {
      configured: true,
      async embed(texts, { taskType } = {}) {
        embedCalls.push({ taskType, texts })
        return [[0.1, 0.2]]
      },
    },
    offeringIds: ['offering-1'],
    query: 'What is machine learning?',
    threadId: 'thread-1',
    topK: 4,
    userId: 'user-1',
    vectorStore: {
      configured: true,
      async search(input) {
        searchCalls.push(input)
        return [
          {
            id: 'point-1',
            locator: { offeringId: 'offering-1' },
            score: 0.9,
            source: 'course',
            text: 'Models learn patterns from data.',
            title: 'Week 1',
          },
        ]
      },
    },
  })

  assert.equal(embedCalls[0].taskType, 'RETRIEVAL_QUERY')
  assert.equal(searchCalls[0].limit, 4)
  assert.equal(documents.length, 1)
  assert.equal(documents[0].score, 0.9)
})

test('retrieve searches each offering separately when multiple courses are in scope', async () => {
  const searchCalls = []
  const documents = await retrieve({
    embedder: {
      configured: true,
      async embed(texts, { taskType } = {}) {
        assert.equal(taskType, 'RETRIEVAL_QUERY')
        return [[0.1, 0.2]]
      },
    },
    offeringIds: ['offering-1', 'offering-2'],
    query: 'List assignments',
    threadId: 'thread-1',
    topK: 8,
    userId: 'user-1',
    vectorStore: {
      configured: true,
      async search(input) {
        searchCalls.push(input)
        return [
          {
            courseCode: input.filter.must[1].match.value,
            id: `point-${searchCalls.length}`,
            score: 0.9 - searchCalls.length * 0.1,
            source: 'course',
            text: `Assignments for ${input.filter.must[1].match.value}`,
            title: `Course ${searchCalls.length}`,
          },
        ]
      },
    },
  })

  assert.equal(searchCalls.length, 4)
  assert.equal(searchCalls[0].limit, 4)
  assert.equal(searchCalls[1].limit, 4)
  assert.equal(documents.length, 4)
})

const errorIndexOffering = {
  ...offering,
  swinlearnKnowledgeIndex: {
    errorMessage: 'Gemini embedding request failed.',
    id: 'index-1',
    offeringId: 'offering-1',
    packageId: 'package-1',
    status: 'error',
    vectorStoreId: null,
  },
}

function createIndexingPrisma(offeringRecord) {
  return {
    courseOffering: {
      findUnique: async () => offeringRecord,
    },
    swinlearnKnowledgeIndex: {
      upsert: async ({ create, update }) => ({
        offeringId: offeringRecord.id,
        packageId: offeringRecord.contentPackages[0].id,
        status: 'indexing',
        ...(update ?? create),
      }),
      update: async ({ data }) => ({
        offeringId: offeringRecord.id,
        packageId: offeringRecord.contentPackages[0].id,
        vectorStoreId: data.vectorStoreId ?? null,
        ...data,
      }),
    },
  }
}

function createIndexingDeps() {
  let embedCalls = 0

  return {
    embedCalls: () => embedCalls,
    embedder: {
      configured: true,
      async embed() {
        embedCalls += 1
        return [[1, 0]]
      },
    },
    vectorStore: {
      configured: true,
      async deleteByFilter() {},
      async upsert() {},
    },
  }
}

test('ensureIndexedOfferings skips error status unless force is true', async () => {
  const deps = createIndexingDeps()
  const prisma = createIndexingPrisma(errorIndexOffering)

  const skipped = await ensureIndexedOfferings({
    embedder: deps.embedder,
    force: false,
    offeringIds: ['offering-1'],
    prisma,
    vectorStore: deps.vectorStore,
  })

  assert.equal(deps.embedCalls(), 0)
  assert.equal(skipped[0].status, 'error')

  const retried = await ensureIndexedOfferings({
    embedder: deps.embedder,
    force: true,
    offeringIds: ['offering-1'],
    prisma,
    vectorStore: deps.vectorStore,
  })

  assert.ok(deps.embedCalls() > 0)
  assert.equal(retried[0].status, 'ready')
})

test('ensureIndexedOfferings re-indexes ready offerings when force is true', async () => {
  const readyIndexOffering = {
    ...offering,
    swinlearnKnowledgeIndex: {
      id: 'index-ready',
      offeringId: 'offering-1',
      packageId: 'package-1',
      status: 'ready',
      vectorStoreId: 'swinlearn-course-knowledge',
    },
  }
  const deps = createIndexingDeps()
  const prisma = createIndexingPrisma(readyIndexOffering)

  const skipped = await ensureIndexedOfferings({
    embedder: deps.embedder,
    force: false,
    offeringIds: ['offering-1'],
    prisma,
    vectorStore: deps.vectorStore,
  })

  assert.equal(deps.embedCalls(), 0)
  assert.equal(skipped[0].status, 'ready')

  const reindexed = await ensureIndexedOfferings({
    embedder: deps.embedder,
    force: true,
    offeringIds: ['offering-1'],
    prisma,
    vectorStore: deps.vectorStore,
  })

  assert.ok(deps.embedCalls() > 0)
  assert.equal(reindexed[0].status, 'ready')
})
