import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./AdminCoursesPage.tsx', import.meta.url), 'utf8')
const workspaceCss = readFileSync(new URL('../../styles/WorkspacePages.css', import.meta.url), 'utf8')

test('AdminCoursesPage curriculum and catalog tables use aligned subgrid columns', () => {
  assert.match(page, /admin-courses-table-scroll/)
  assert.match(page, /admin-courses-table-header/)
  assert.match(page, /admin-courses-course/)
  assert.match(page, /admin-courses-column--type/)
  assert.match(page, /admin-courses-column--scope/)
  assert.match(page, /admin-courses-column--offerings/)
  assert.match(workspaceCss, /\.admin-courses-table\s*\{/)
  assert.match(workspaceCss, /grid-template-columns: subgrid/)
})
