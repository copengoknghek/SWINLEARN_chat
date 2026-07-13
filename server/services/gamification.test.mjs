import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GOLD_AMOUNTS,
  NEWBIE_GOLD_THRESHOLD,
  badgesForUser,
  currentIsoWeekKey,
  goldForEvent,
  selectChampion,
  shouldShowNewbieBadge,
} from './gamification.js'

test('goldForEvent returns configured amounts', () => {
  assert.equal(goldForEvent('like_received'), 1)
  assert.equal(goldForEvent('comment_received'), 2)
  assert.equal(goldForEvent('share_received'), 3)
  assert.equal(goldForEvent('weekly_badge'), 5)
})

test('selectChampion picks highest metric with earliest since tie-break', () => {
  const champion = selectChampion([
    { userId: 'a', metric: 10, since: new Date('2026-06-02') },
    { userId: 'b', metric: 12, since: new Date('2026-06-01') },
    { userId: 'c', metric: 12, since: new Date('2026-05-30') },
  ])

  assert.equal(champion.userId, 'c')
})

test('selectChampion ignores zero metrics', () => {
  assert.equal(selectChampion([{ userId: 'a', metric: 0, since: new Date() }]), null)
})

test('shouldShowNewbieBadge is true for new students below threshold', () => {
  assert.equal(
    shouldShowNewbieBadge({ id: 's1', role: 'student', goldBalance: NEWBIE_GOLD_THRESHOLD - 1 }),
    true,
  )
})

test('shouldShowNewbieBadge is false for active students', () => {
  assert.equal(
    shouldShowNewbieBadge({ id: 's1', role: 'student', goldBalance: NEWBIE_GOLD_THRESHOLD }),
    false,
  )
  assert.equal(shouldShowNewbieBadge({ id: 's1', role: 'student', goldBalance: 0 }, new Set(['s1'])), false)
})

test('badgesForUser includes newbie for eligible students', () => {
  const badges = badgesForUser(
    { id: 's1', role: 'student', goldBalance: 2 },
    new Map(),
    new Set(),
  )

  assert.deepEqual(badges, ['NEWBIE'])
})

test('badgesForUser includes champion badges and skips newbie when active', () => {
  const badges = badgesForUser(
    { id: 's1', role: 'student', goldBalance: 20 },
    new Map([['s1', ['GOLD_KING']]]),
    new Set(['s1']),
  )

  assert.deepEqual(badges, ['GOLD_KING'])
})

test('currentIsoWeekKey returns stable week label', () => {
  const weekKey = currentIsoWeekKey(new Date('2026-06-25T12:00:00.000Z'))

  assert.match(weekKey, /^2026-W\d{2}$/)
})

test('weekly badge amount matches product rule', () => {
  assert.equal(GOLD_AMOUNTS.weekly_badge, 5)
})
