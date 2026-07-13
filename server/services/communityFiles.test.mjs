import assert from 'node:assert/strict'
import test from 'node:test'

import {
  communityMaxImageBytes,
  validateCommunityAttachment,
  validateCommunityImage,
} from './communityFiles.js'

test('validateCommunityImage accepts common image uploads', () => {
  const result = validateCommunityImage({
    mimetype: 'image/png',
    originalname: 'screenshot.png',
    path: 'uploads/community/abc123',
    size: 1024,
  })

  assert.equal(result.originalName, 'screenshot.png')
  assert.equal(result.publicUrl, '/uploads/community/abc123')
})

test('validateCommunityImage rejects unsupported types and oversized files', () => {
  assert.throws(
    () =>
      validateCommunityImage({
        mimetype: 'application/pdf',
        originalname: 'notes.pdf',
        path: 'uploads/community/abc123',
        size: 1024,
      }),
    (error) => error.statusCode === 400,
  )

  assert.throws(
    () =>
      validateCommunityImage({
        mimetype: 'image/png',
        originalname: 'huge.png',
        path: 'uploads/community/abc123',
        size: communityMaxImageBytes + 1,
      }),
    (error) => error.statusCode === 400,
  )
})

test('validateCommunityAttachment accepts image, Word, PDF, and ZIP uploads', () => {
  const cases = [
    { mimetype: 'image/png', originalname: 'screenshot.png' },
    { mimetype: 'application/pdf', originalname: 'notes.pdf' },
    {
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalname: 'brief.docx',
    },
    { mimetype: 'application/msword', originalname: 'legacy.doc' },
    { mimetype: 'application/zip', originalname: 'archive.zip' },
  ]

  for (const file of cases) {
    const result = validateCommunityAttachment({
      ...file,
      path: 'uploads/community/abc123',
      size: 1024,
    })

    assert.equal(result.originalName, file.originalname)
    assert.equal(result.publicUrl, '/uploads/community/abc123')
  }
})

test('validateCommunityAttachment rejects unsupported attachments', () => {
  assert.throws(
    () =>
      validateCommunityAttachment({
        mimetype: 'application/x-msdownload',
        originalname: 'setup.exe',
        path: 'uploads/community/abc123',
        size: 1024,
      }),
    (error) => error.statusCode === 400,
  )
})
