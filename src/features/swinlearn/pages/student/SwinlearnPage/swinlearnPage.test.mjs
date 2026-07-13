import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./SwinlearnPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./SwinlearnPage.css', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../../lib/workspace/api.ts', import.meta.url), 'utf8')
const types = readFileSync(new URL('../../../lib/workspace/types.ts', import.meta.url), 'utf8')

test('SwinlearnPage uses the real SWINLEARN chat API and persistent thread state', () => {
  assert.match(page, /fetchSwinlearnContext/)
  assert.match(page, /fetchSwinlearnThreads/)
  assert.match(page, /createSwinlearnThread/)
  assert.match(page, /fetchSwinlearnThread/)
  assert.match(page, /updateSwinlearnThread/)
  assert.match(page, /deleteSwinlearnThread/)
  assert.match(page, /sendSwinlearnMessage/)
  assert.match(page, /selectedOfferingIds/)
  assert.match(page, /activeThread/)
  assert.match(page, /swinlearn-thread-menu/)
  assert.match(page, /Change name/)
  assert.match(page, /Pin chat/)
  assert.match(page, /Delete/)
})

test('SwinlearnPage allows clearing all course selections', () => {
  assert.doesNotMatch(page, /next\.length > 0 \? next : current/)
  assert.match(page, /setSelectedOfferingIds\(\[\]\)/)
})

test('SwinlearnPage renders course filters, file upload, quick summaries, and citations', () => {
  assert.match(page, /type="file"/)
  assert.match(page, /const uploadAccept =\s*'\.pdf,\s*\.doc,\s*\.docx,\s*\.ppt,\s*\.pptx,\s*\.txt,\s*\.md,\s*\.html,\s*image\/\*'/)
  assert.match(page, /accept=\{uploadAccept\}/)
  assert.match(page, /CV example prompt/)
  assert.match(page, /CV all submitted in course/)
  assert.match(page, /Perfect CV/)
  assert.match(page, /PerfectCvProjectPicker/)
  assert.match(page, /PerfectCvEditPanel/)
  assert.match(page, /PerfectCvPreview/)
  assert.match(page, /CvProjectPreview/)
  assert.match(page, /cvProjectMarkdownToWordHtml/)
  assert.match(page, /Edit &amp; download/)
  assert.match(page, /Download as Markdown/)
  assert.match(page, /Download as Word/)
  assert.match(page, /downloadCvWord/)
  assert.match(page, /Summarize selected course/)
  assert.doesNotMatch(page, /Find topic location/)
  assert.match(page, /swinlearn-source-card/)
  assert.match(page, /MessageCitationList/)
  assert.match(page, /VISIBLE_CITATION_COUNT = 2/)
  assert.match(page, /swinlearn-source-more/)
  assert.match(page, /swinlearn-course-filter/)
})

test('SwinlearnPage does not expose course indexing controls to students', () => {
  assert.doesNotMatch(page, /indexSwinlearnCourses/)
  assert.doesNotMatch(page, /Index selected courses/)
  assert.doesNotMatch(page, /swinlearn-index-btn/)
})

test('SwinlearnPage knowledge index helpers are shared with admin course offer UI', () => {
  const shared = readFileSync(
    new URL('../../../lib/swinlearnKnowledgeIndex.mjs', import.meta.url),
    'utf8',
  )

  assert.match(shared, /formatKnowledgeIndexStatus/)
  assert.match(shared, /needsKnowledgeIndexing/)
})

test('SwinlearnPage CSS supports real chat messages and source cards responsively', () => {
  assert.match(css, /\.swinlearn-message--assistant/)
  assert.match(css, /\.swinlearn-message--student/)
  assert.match(css, /\.swinlearn-source-card/)
  assert.match(css, /\.swinlearn-source-more/)
  assert.match(css, /\.swinlearn-course-filter/)
  assert.match(css, /\.perfect-cv-preview/)
  assert.match(css, /\.cv-project-preview/)
  assert.match(css, /\.cv-project-preview-h1/)
  assert.match(css, /\.perfect-cv-preview-name/)
  assert.doesNotMatch(css, /swinlearn-layout--perfect-cv-open/)
})

test('SwinlearnPage swaps Perfect CV into the right rail instead of adding a fourth column', () => {
  assert.match(page, /const showRightRail = showFiles \|\| perfectCvPanelMessage !== null/)
  assert.match(page, /const layoutClassName = \[/)
  assert.match(page, /swinlearn-layout--has-history/)
  assert.match(page, /swinlearn-layout--has-right/)
  assert.match(page, /const closePerfectCvPanel = \(\) => \{/)
  assert.match(page, /setShowFiles\(true\)/)
  assert.match(page, /showRightRail &&/)
  assert.match(page, /perfectCvPanelMessage \? \(/)
  assert.doesNotMatch(page, /swinlearn-layout--perfect-cv-open/)
})

test('SwinlearnPage layout grid expands chat when history or courses panels are hidden', () => {
  assert.match(css, /\.swinlearn-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(css, /\.swinlearn-layout--has-history\.swinlearn-layout--has-right/)
  assert.match(css, /grid-template-columns:\s*260px minmax\(0,\s*1fr\) 280px/)
  assert.match(css, /\.swinlearn-layout--has-history:not\(\.swinlearn-layout--has-right\)/)
  assert.match(css, /grid-template-columns:\s*260px minmax\(0,\s*1fr\)/)
  assert.match(css, /\.swinlearn-layout--has-right:not\(\.swinlearn-layout--has-history\)/)
})

test('SwinlearnPage chat stays viewport-bound while messages scroll internally', () => {
  const workspaceRule = css.match(/\.swinlearn-workspace\s*\{[^}]*\}/)
  const layoutRule = css.match(/\.swinlearn-layout\s*\{[^}]*\}/)
  const chatMainRule = css.match(/\.chat-main\s*\{[^}]*\}/)
  const messagesContainerRule = css.match(/\.chat-messages-container\s*\{[^}]*\}/)
  const messageListRule = css.match(/\.swinlearn-message-list\s*\{[^}]*\}/)

  assert.ok(workspaceRule, 'swinlearn workspace rule should exist')
  assert.match(workspaceRule[0], /display:\s*flex/)
  assert.match(workspaceRule[0], /flex-direction:\s*column/)
  assert.match(workspaceRule[0], /height:\s*calc\(100vh - 30px\)/)
  assert.match(workspaceRule[0], /min-height:\s*0/)
  assert.match(workspaceRule[0], /overflow:\s*hidden/)

  assert.ok(layoutRule, 'swinlearn layout rule should exist')
  assert.match(layoutRule[0], /flex:\s*1/)
  assert.match(layoutRule[0], /min-height:\s*0/)
  assert.match(layoutRule[0], /overflow:\s*hidden/)
  assert.doesNotMatch(layoutRule[0], /height:\s*calc\(100vh - [^)]+\)/)

  assert.ok(chatMainRule, 'chat main rule should exist')
  assert.match(chatMainRule[0], /min-height:\s*0/)

  assert.ok(messagesContainerRule, 'chat messages container rule should exist')
  assert.match(messagesContainerRule[0], /min-height:\s*0/)
  assert.match(messagesContainerRule[0], /overflow:\s*hidden/)

  assert.ok(messageListRule, 'swinlearn message list rule should exist')
  assert.match(messageListRule[0], /min-height:\s*0/)
  assert.match(messageListRule[0], /overflow-y:\s*auto/)
  assert.match(messageListRule[0], /overscroll-behavior:\s*contain/)
})

test('workspace API and types expose SWINLEARN thread, message, attachment, citation, and context contracts', () => {
  assert.match(api, /fetchSwinlearnContext/)
  assert.match(api, /sendSwinlearnMessage/)
  assert.match(api, /fetchSubmittedProjects/)
  assert.match(api, /fetchCvProfile/)
  assert.match(api, /updateCvProfile/)
  assert.match(api, /assignment_ids/)
  assert.match(types, /perfect_cv_export/)
  assert.match(types, /headline_role/)
  assert.match(api, /intent/)
  assert.match(api, /updateSwinlearnThread/)
  assert.match(api, /deleteSwinlearnThread/)
  assert.match(types, /export type SwinlearnThreadRow/)
  assert.match(types, /pinned: boolean/)
  assert.match(types, /export type SwinlearnMessageRow/)
  assert.match(types, /contentType\?: 'cv_export'/)
  assert.match(page, /Build my Perfect CV from the selected projects/)
  assert.match(types, /export type SwinlearnAttachmentRow/)
  assert.match(types, /export type SwinlearnCitationRow/)
  assert.match(types, /export type SwinlearnContextData/)
})
