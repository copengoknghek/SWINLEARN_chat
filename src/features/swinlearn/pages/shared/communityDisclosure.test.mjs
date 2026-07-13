import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const courseDetailPage = readFileSync(new URL('./CourseDetailPage.tsx', import.meta.url), 'utf8')
const commentThread = readFileSync(new URL('./CommunityCommentThread.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../styles/WorkspacePages.css', import.meta.url), 'utf8')

test('community post composer is hidden behind an explicit New post action', () => {
  assert.match(courseDetailPage, /isCommunityPostComposerOpen,\s*setCommunityPostComposerOpen/)
  assert.match(courseDetailPage, /setCommunityPostComposerOpen\(true\)/)
  assert.match(courseDetailPage, /isCommunityPostComposerOpen\s*&&\s*\(/)
})

test('community comments stay hidden until the post Comment action is toggled', () => {
  assert.match(courseDetailPage, /openCommunityCommentPostIds,\s*setOpenCommunityCommentPostIds/)
  assert.match(courseDetailPage, /toggleCommunityComments\(post\.id\)/)
  assert.match(courseDetailPage, /isCommentsOpen\s*&&\s*\(/)
})

test('course detail alerts dismiss success and error messages after five seconds', () => {
  assert.match(courseDetailPage, /const workspaceAlertDismissMs = 5000/)
  assert.match(courseDetailPage, /if \(error === '' && notice === ''\) \{/)
  assert.match(courseDetailPage, /const timeoutId = window\.setTimeout\(\(\) => \{/)
  assert.match(courseDetailPage, /setError\(''\)/)
  assert.match(courseDetailPage, /setNotice\(''\)/)
  assert.match(courseDetailPage, /}, workspaceAlertDismissMs\)/)
  assert.match(courseDetailPage, /return \(\) => window\.clearTimeout\(timeoutId\)/)
})

test('course detail alerts render as top-right dismissible notifications', () => {
  assert.match(courseDetailPage, /const renderWorkspaceAlerts = \(\) => \(/)
  assert.match(courseDetailPage, /className="workspace-alert-stack"/)
  assert.match(courseDetailPage, /className="workspace-alert workspace-alert--error"/)
  assert.match(courseDetailPage, /aria-label="Dismiss error alert"/)
  assert.match(courseDetailPage, /onClick=\{\(\) => setError\(''\)\}/)
  assert.match(courseDetailPage, /className="workspace-alert workspace-alert--success"/)
  assert.match(courseDetailPage, /aria-label="Dismiss success alert"/)
  assert.match(courseDetailPage, /onClick=\{\(\) => setNotice\(''\)\}/)
  assert.match(courseDetailPage, /className="workspace-alert-close"/)
  assert.match(courseDetailPage, /×/)

  assert.match(css, /\.workspace-alert-stack\s*\{[\s\S]*position:\s*fixed/)
  assert.match(css, /\.workspace-alert-stack\s*\{[\s\S]*right:\s*24px/)
  assert.match(css, /\.workspace-alert-stack\s*\{[\s\S]*top:\s*24px/)
  assert.match(css, /\.workspace-alert-close\s*\{[\s\S]*background:\s*transparent/)
  assert.match(css, /\.workspace-alert-close\s*\{[\s\S]*border:\s*0/)
  assert.match(css, /\.workspace-alert-close\s*\{[\s\S]*color:\s*#dc2626/)
})

test('comment media controls disclose image and GIF fields from icon-only controls', () => {
  assert.match(commentThread, /showImageTools,\s*setShowImageTools/)
  assert.match(commentThread, /showGifField,\s*setShowGifField/)
  assert.match(commentThread, /aria-label="Add file to comment"/)
  assert.match(commentThread, /aria-label="Add GIF link to comment"/)
  assert.match(commentThread, /CommunityMediaIcon/)
  assert.match(commentThread, /kind: 'file' \| 'gif'/)
  assert.match(commentThread, /<svg/)
  assert.match(commentThread, /showGifField\s*&&\s*\(/)
  assert.match(commentThread, /showImageTools\s*&&\s*\(/)
  assert.doesNotMatch(commentThread, />Image</)
  assert.doesNotMatch(commentThread, />GIF</)
  assert.doesNotMatch(commentThread, /course-detail-community-icon-label/)
})

test('comment file upload accepts images, Word, PDF, and ZIP files', () => {
  assert.match(commentThread, /communityCommentUploadAccept/)
  assert.match(commentThread, /\.doc,\s*\.docx,\s*\.pdf,\s*\.zip,\s*image\/\*/)
  assert.match(commentThread, /accept=\{communityCommentUploadAccept\}/)
})

test('comment composer keeps media icons inside the input shell with submit beside it', () => {
  assert.match(commentThread, /course-detail-community-entry-row/)
  assert.match(commentThread, /course-detail-community-input-shell/)
  assert.match(commentThread, /course-detail-community-placeholder-icons/)
  assert.match(commentThread, /course-detail-community-submit/)
  assert.match(
    commentThread,
    /course-detail-community-input-shell[\s\S]*<textarea[\s\S]*placeholder=\{placeholder\}[\s\S]*course-detail-community-placeholder-icons/,
  )
  assert.match(css, /\.course-detail-community-entry-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.match(css, /\.course-detail-community-input-shell\s*\{[\s\S]*position:\s*relative/)
  assert.match(css, /\.course-detail-community-placeholder-icons\s*\{[\s\S]*position:\s*absolute/)
  assert.match(css, /\.course-detail-community-submit/)
})

test('community disclosure controls have compact icon-only styling', () => {
  assert.match(css, /\.course-detail-community-icon-action/)
  assert.match(css, /\.course-detail-community-icon-action svg/)
  assert.match(css, /background:\s*transparent/)
  assert.match(css, /border:\s*0/)
  assert.match(css, /\.course-detail-community-disclosure/)
  assert.doesNotMatch(css, /course-detail-community-icon-label/)
})
