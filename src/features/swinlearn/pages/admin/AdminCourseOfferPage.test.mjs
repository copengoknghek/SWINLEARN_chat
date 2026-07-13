import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./AdminCourseOfferPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./AdminCourseOfferPage.css', import.meta.url), 'utf8')
const courseDetailPage = readFileSync(new URL('../shared/CourseDetailPage.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../../components/SwinlearnKnowledgeIndexPanel.tsx', import.meta.url), 'utf8')
const workspaceCss = readFileSync(new URL('../../styles/WorkspacePages.css', import.meta.url), 'utf8')
const adminRoute = readFileSync(new URL('../../../../../server/routes/admin.js', import.meta.url), 'utf8')
const workspaceRoute = readFileSync(new URL('../../../../../server/routes/workspace.js', import.meta.url), 'utf8')

test('AdminCourseOfferPage offerings table uses aligned subgrid columns like user management', () => {
  assert.match(page, /admin-course-offer-table-scroll/)
  assert.match(page, /admin-course-offer-table-header/)
  assert.match(page, /admin-course-offer-course/)
  assert.match(page, /admin-course-offer-column--term/)
  assert.match(page, /admin-course-offer-column--status/)
  assert.match(page, /admin-course-offer-column--roster/)
  assert.match(page, /admin-course-offer-column--members/)
  assert.match(workspaceCss, /\.admin-course-offer-table\s*\{/)
  assert.match(workspaceCss, /grid-template-columns: subgrid/)
  assert.doesNotMatch(page, /admin-course-offer-list"/)
})

test('AdminCourseOfferPage exposes SWINLEARN knowledge indexing for imported offerings', () => {
  assert.match(page, /SwinlearnKnowledgeIndexPanel/)
  assert.match(page, /indexSwinlearnCourses/)
  assert.match(page, /handleIndexKnowledge/)
})

test('CourseDetailPage lets teachers re-index SWINLEARN knowledge from assignments', () => {
  assert.match(courseDetailPage, /SwinlearnKnowledgeIndexPanel/)
  assert.match(courseDetailPage, /indexSwinlearnCourses/)
  assert.match(courseDetailPage, /handleIndexKnowledge/)
  assert.match(courseDetailPage, /workspaceRole === 'teacher'/)
  assert.match(courseDetailPage, /Re-index SWINLEARN knowledge/)
})

test('SwinlearnKnowledgeIndexPanel supports index and re-index labels', () => {
  assert.match(panel, /knowledgeIndexActionLabel/)
  assert.match(panel, /hasIndexableCourseKnowledge/)
})

test('admin course-data includes SWINLEARN knowledge index status per offering', () => {
  assert.match(adminRoute, /knowledgeIndexes:/)
  assert.match(adminRoute, /buildKnowledgeIndexView/)
})

test('course detail and assignment updates expose SWINLEARN knowledge index data', () => {
  assert.match(workspaceRoute, /knowledge_index: buildKnowledgeIndexView/)
  assert.match(workspaceRoute, /markSwinlearnIndexesStaleForOffering/)
})

test('shared SWINLEARN knowledge index styles live in workspace CSS', () => {
  assert.match(workspaceCss, /\.swinlearn-knowledge-index-panel/)
  assert.match(workspaceCss, /\.swinlearn-knowledge-index-status--ready/)
  assert.match(workspaceCss, /\.course-detail-swinlearn-index/)
  assert.doesNotMatch(css, /admin-knowledge-index-status/)
})
