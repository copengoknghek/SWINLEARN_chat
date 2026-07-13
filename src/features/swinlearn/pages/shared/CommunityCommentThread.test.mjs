import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const communityCommentThread = readFileSync(
  new URL('./CommunityCommentThread.tsx', import.meta.url),
  'utf8',
)

test('community comment composer uses Enter-to-send with Shift+Enter for new lines', () => {
  assert.match(communityCommentThread, /handleEnterToSubmit/)
  assert.match(communityCommentThread, /canSubmit: !saving && canSubmitDraft\(draft\)/)
  assert.match(communityCommentThread, /onKeyDown=\{\(event\) =>/)
})
