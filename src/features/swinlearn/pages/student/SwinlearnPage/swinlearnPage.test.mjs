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

test('SwinlearnPage renders course filters, file upload, quick summaries, and citations', () => {
  assert.match(page, /type="file"/)
  assert.match(page, /const uploadAccept =\s*'\.pdf,\s*\.doc,\s*\.docx,\s*\.ppt,\s*\.pptx,\s*\.txt,\s*\.md,\s*\.html,\s*image\/\*'/)
  assert.match(page, /accept=\{uploadAccept\}/)
  assert.match(page, /Summarize selected course/)
  assert.match(page, /Find topic location/)
  assert.match(page, /swinlearn-source-card/)
  assert.match(page, /swinlearn-course-filter/)
})

test('SwinlearnPage CSS supports real chat messages and source cards responsively', () => {
  assert.match(css, /\.swinlearn-message--assistant/)
  assert.match(css, /\.swinlearn-message--student/)
  assert.match(css, /\.swinlearn-source-card/)
  assert.match(css, /\.swinlearn-course-filter/)
  assert.match(css, /grid-template-columns:\s*260px minmax\(0, 1fr\) 280px/)
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
  assert.match(api, /updateSwinlearnThread/)
  assert.match(api, /deleteSwinlearnThread/)
  assert.match(types, /export type SwinlearnThreadRow/)
  assert.match(types, /pinned: boolean/)
  assert.match(types, /export type SwinlearnMessageRow/)
  assert.match(types, /export type SwinlearnAttachmentRow/)
  assert.match(types, /export type SwinlearnCitationRow/)
  assert.match(types, /export type SwinlearnContextData/)
})
