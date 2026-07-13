import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('./WorkspaceLayout.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./WorkspaceLayout.css', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../lib/workspace/api.ts', import.meta.url), 'utf8')
const types = readFileSync(new URL('../../lib/workspace/types.ts', import.meta.url), 'utf8')

test('WorkspaceLayout polls inbox badge and renders navbar notification count', () => {
  assert.match(layout, /fetchInboxBadge/)
  assert.match(layout, /setInterval\(\(\) => void loadInboxBadge\(\), 15000\)/)
  assert.match(layout, /workspace-nav-badge/)
  assert.match(layout, /inboxBadgeTotal > 0/)
  assert.match(layout, /Inbox, \$\{inboxBadgeTotal\} notifications/)
  assert.match(api, /fetchInboxBadge/)
  assert.match(api, /\/api\/workspace\/inbox\/badge/)
  assert.match(types, /export type InboxBadgeSummary/)
})

test('WorkspaceLayout inbox badge styles work on stacked nav icons', () => {
  assert.match(css, /\.workspace-nav-link--inbox/)
  assert.match(css, /\.workspace-nav-icon-wrap/)
  assert.match(css, /\.workspace-nav-badge/)
})
