import assert from 'node:assert/strict'
import test from 'node:test'

import {
  knowledgeIndexActionLabel,
  needsKnowledgeIndexing,
} from './swinlearnKnowledgeIndex.mjs'

test('knowledgeIndexActionLabel switches between index and re-index copy', () => {
  assert.equal(knowledgeIndexActionLabel('missing'), 'Index course knowledge')
  assert.equal(knowledgeIndexActionLabel('ready'), 'Re-index course knowledge')
  assert.equal(knowledgeIndexActionLabel('ready', true), 'Re-indexing course knowledge...')
  assert.equal(knowledgeIndexActionLabel('stale', true), 'Indexing course knowledge...')
})

test('needsKnowledgeIndexing covers stale and error states', () => {
  assert.equal(needsKnowledgeIndexing('ready'), false)
  assert.equal(needsKnowledgeIndexing('stale'), true)
  assert.equal(needsKnowledgeIndexing('failed'), true)
})
