import assert from 'node:assert/strict'
import test from 'node:test'

import { chunkText } from './textChunker.js'

test('chunkText returns a single chunk for short text', () => {
  const chunks = chunkText('Short study note.')

  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].chunkIndex, 0)
  assert.equal(chunks[0].text, 'Short study note.')
})

test('chunkText splits long text with overlap and paragraph awareness', () => {
  const paragraphA = 'A'.repeat(700)
  const paragraphB = 'B'.repeat(700)
  const chunks = chunkText(`${paragraphA}\n\n${paragraphB}`, {
    maxChars: 800,
    overlap: 100,
  })

  assert.ok(chunks.length >= 2)
  assert.ok(chunks.every((chunk) => chunk.text.length <= 800))
  assert.equal(chunks[0].chunkIndex, 0)
  assert.equal(chunks[1].chunkIndex, 1)
})

test('chunkText returns empty array for blank input', () => {
  assert.deepEqual(chunkText('   '), [])
})
