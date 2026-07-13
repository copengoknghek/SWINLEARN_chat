import assert from 'node:assert/strict'
import test from 'node:test'

import { extractUploadText, parseStudyDocumentFile, validateSwinlearnUpload } from './swinlearnFiles.js'

const file = (overrides) => ({
  mimetype: 'application/pdf',
  originalname: 'lecture.pdf',
  size: 1024,
  ...overrides,
})

test('validateSwinlearnUpload marks text-like study files as readable Groq context', () => {
  const result = validateSwinlearnUpload(file({
    mimetype: 'text/markdown',
    originalname: 'week-1.md',
  }))

  assert.equal(result.kind, 'document')
  assert.equal(result.readableAsText, true)
  assert.equal(result.supportedByFileSearch, true)
})

test('validateSwinlearnUpload marks office study files as searchable RAG sources', () => {
  const result = validateSwinlearnUpload(file({ originalname: 'week-1.pptx' }))

  assert.equal(result.kind, 'document')
  assert.equal(result.readableAsText, true)
  assert.equal(result.supportedByFileSearch, true)
})

test('validateSwinlearnUpload accepts images as current-turn context only', () => {
  const result = validateSwinlearnUpload(file({
    mimetype: 'image/png',
    originalname: 'diagram.png',
  }))

  assert.equal(result.kind, 'image')
  assert.equal(result.supportedByFileSearch, false)
})

test('validateSwinlearnUpload rejects unsupported files and oversized uploads', () => {
  assert.throws(
    () => validateSwinlearnUpload(file({ originalname: 'program.exe' })),
    /unsupported/i,
  )
  assert.throws(
    () => validateSwinlearnUpload(file({ size: 21 * 1024 * 1024 }), { maxBytes: 20 * 1024 * 1024 }),
    /too large/i,
  )
})

test('parseStudyDocumentFile routes legacy Word files away from OfficeParser', async () => {
  const calls = []

  const text = await parseStudyDocumentFile('/tmp/study.doc', '.doc', {
    parseLegacyDoc: async (filePath) => {
      calls.push(filePath)
      return 'Legacy Word body'
    },
    parseOffice: async () => {
      throw new Error('OfficeParser should not run for .doc files.')
    },
  })

  assert.deepEqual(calls, ['/tmp/study.doc'])
  assert.equal(text, 'Legacy Word body')
})

test('parseStudyDocumentFile reads office files as buffers for extensionless upload paths', async () => {
  const calls = []

  const text = await parseStudyDocumentFile('/tmp/uploads/swinlearn/hash-only', '.docx', {
    readBytes: async () => Buffer.from('fake-docx'),
    parseOffice: async (input) => {
      calls.push(Buffer.isBuffer(input))
      return 'Parsed docx body'
    },
  })

  assert.deepEqual(calls, [true])
  assert.equal(text, 'Parsed docx body')
})

test('parseStudyDocumentFile rejects legacy PowerPoint with a clear message', async () => {
  await assert.rejects(
    () => parseStudyDocumentFile('/tmp/slides.ppt', '.ppt'),
    /Legacy PowerPoint/i,
  )
})

test('extractUploadText uses the study document parser for office uploads', async () => {
  const text = await extractUploadText(
    {
      mimetype: 'application/msword',
      originalname: 'notes.doc',
      path: '/tmp/notes.doc',
    },
    { readableAsText: true },
    {
      parseStudyDocument: async () => 'Placement handbook notes',
    },
  )

  assert.equal(text, 'Placement handbook notes')
})
