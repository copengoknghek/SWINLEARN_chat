import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

import {
  readCanvasCourseDataFromZip,
  rewriteCourseContentHtml,
  sanitizeRichHtml,
  toSafeAssetRelativePath,
} from './courseContentImport.js'

const ict20016ZipPath = process.env.ICT20016_ZIP_PATH ?? 'C:\\Users\\Admin\\Downloads\\ICT20016.zip'

test(
  'readCanvasCourseDataFromZip reads the ICT20016 Canvas export structure',
  { skip: existsSync(ict20016ZipPath) ? false : `Missing ${ict20016ZipPath}` },
  async () => {
    const data = await readCanvasCourseDataFromZip(ict20016ZipPath)

    assert.equal(data.modules.length, 5)
    assert.equal(data.assignments.length, 4)
    assert.equal(data.quizzes.length, 3)
    assert.equal(data.files.length, 17)
    assert.deepEqual(
      data.modules.map((module) => module.items.length),
      [5, 15, 14, 6, 9],
    )
  },
)

test('rewriteCourseContentHtml rewrites exported file links before sanitizing rich HTML', () => {
  const rewritten = rewriteCourseContentHtml(
    '<p><img src="viewer/files/Folder%20One/Guide.pdf?canvas_=1" onerror="alert(1)"></p><script>alert(1)</script><a href="javascript:alert(1)">Bad</a>',
    new Map([
      [
        'viewer/files/Folder One/Guide.pdf',
        '/uploads/course-content/offering/import/Folder%20One/Guide.pdf',
      ],
    ]),
  )
  const sanitized = sanitizeRichHtml(rewritten)

  assert.match(sanitized, /\/uploads\/course-content\/offering\/import\/Folder%20One\/Guide\.pdf/)
  assert.doesNotMatch(sanitized, /onerror/)
  assert.doesNotMatch(sanitized, /<script/)
  assert.doesNotMatch(sanitized, /javascript:/)
})

test('toSafeAssetRelativePath rejects traversal outside viewer files', () => {
  assert.equal(
    toSafeAssetRelativePath('viewer/files/Assignment templates/A3 3M Placement Vietnam 2026.docx'),
    'Assignment templates/A3 3M Placement Vietnam 2026.docx',
  )

  assert.throws(
    () => toSafeAssetRelativePath('viewer/files/../secret.txt'),
    /unsafe asset path/i,
  )
})
