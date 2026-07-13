import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCourseFilter,
  buildRetrievalFilter,
  buildSubmissionDeleteFilter,
  buildSubmissionFilter,
  buildUploadFilter,
  createVectorStore,
  mapSearchResultToDocument,
} from './vectorStore.js'

test('buildCourseFilter scopes search to offering ids', () => {
  assert.deepEqual(buildCourseFilter(['off-1', 'off-2']), {
    must: [
      { key: 'source', match: { value: 'course' } },
      { key: 'offeringId', match: { any: ['off-1', 'off-2'] } },
    ],
  })
})

test('buildUploadFilter scopes search to thread and user', () => {
  assert.deepEqual(buildUploadFilter('thread-1', 'user-1'), {
    must: [
      { key: 'source', match: { value: 'upload' } },
      { key: 'threadId', match: { value: 'thread-1' } },
      { key: 'userId', match: { value: 'user-1' } },
    ],
  })
})

test('buildRetrievalFilter combines course, upload, and submission scopes', () => {
  assert.deepEqual(buildRetrievalFilter({
    offeringIds: ['off-1'],
    threadId: 'thread-1',
    userId: 'user-1',
  }), {
    should: [
      buildCourseFilter(['off-1']),
      buildUploadFilter('thread-1', 'user-1'),
      buildSubmissionFilter('user-1', ['off-1']),
    ],
  })
})

test('buildSubmissionDeleteFilter scopes delete to one submission', () => {
  assert.deepEqual(
    buildSubmissionDeleteFilter({ assignmentId: 'asg-1', studentId: 'student-1' }),
    {
      must: [
        { key: 'source', match: { value: 'submission' } },
        { key: 'studentId', match: { value: 'student-1' } },
        { key: 'assignmentId', match: { value: 'asg-1' } },
      ],
    },
  )
})

test('mapSearchResultToDocument maps payload and score', () => {
  const document = mapSearchResultToDocument({
    id: 'point-1',
    payload: {
      chunkIndex: 2,
      offeringId: 'off-1',
      source: 'course',
      text: 'Chunk body',
      title: 'Week 1',
    },
    score: 0.91,
  })

  assert.equal(document.id, 'point-1')
  assert.equal(document.source, 'course')
  assert.equal(document.title, 'Week 1')
  assert.equal(document.text, 'Chunk body')
  assert.equal(document.score, 0.91)
  assert.equal(document.locator.offeringId, 'off-1')
})

test('createVectorStore returns unconfigured when url is missing', async () => {
  const store = createVectorStore({ url: '' })

  assert.equal(store.configured, false)
  await assert.rejects(() => store.search({ vector: [1], filter: {} }), /not configured/i)
})

test('createVectorStore ensures collection and searches with payload', async () => {
  const calls = []
  const client = {
    collectionExists: async () => ({ exists: false }),
    createCollection: async (...args) => {
      calls.push(['createCollection', ...args])
    },
    delete: async (...args) => {
      calls.push(['delete', ...args])
    },
    search: async (...args) => {
      calls.push(['search', ...args])
      return [
        {
          id: 'point-1',
          payload: { source: 'course', text: 'hello', title: 'Intro' },
          score: 0.8,
        },
      ]
    },
    upsert: async (...args) => {
      calls.push(['upsert', ...args])
    },
  }

  const store = createVectorStore({
    clientFactory: () => client,
    url: 'http://localhost:6333',
    vectorSize: 768,
  })

  await store.ensureCollection()
  await store.upsert([
    {
      id: 'point-1',
      payload: { source: 'course', text: 'hello' },
      vector: [0.1, 0.2],
    },
  ])
  const results = await store.search({
    filter: buildCourseFilter(['off-1']),
    limit: 5,
    vector: [0.1, 0.2],
  })

  assert.equal(calls[0][0], 'createCollection')
  assert.equal(calls[0][1], 'swinlearn_chunks')
  assert.equal(calls[1][0], 'upsert')
  assert.equal(calls[2][0], 'search')
  assert.equal(results.length, 1)
  assert.equal(results[0].text, 'hello')
})
