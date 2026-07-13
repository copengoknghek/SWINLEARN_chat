import assert from 'node:assert/strict'
import test from 'node:test'

import { intervalsOverlap, roomIsFree } from './roomAvailability.js'

test('intervalsOverlap detects overlapping ranges', () => {
  const start = new Date('2026-06-20T10:00:00')
  const end = new Date('2026-06-20T10:30:00')

  assert.equal(intervalsOverlap(start, end, new Date('2026-06-20T10:15:00'), new Date('2026-06-20T11:00:00')), true)
  assert.equal(intervalsOverlap(start, end, new Date('2026-06-20T09:00:00'), new Date('2026-06-20T10:00:00')), false)
  assert.equal(intervalsOverlap(start, end, new Date('2026-06-20T10:30:00'), new Date('2026-06-20T11:00:00')), false)
})

test('roomIsFree rejects overlapping approved consultations and class sessions', () => {
  const slotStart = new Date('2026-06-20T10:00:00')
  const slotEnd = new Date('2026-06-20T10:30:00')
  const room = { id: 'room-1', name: 'Japan' }

  assert.equal(
    roomIsFree({
      room,
      startsAt: slotStart,
      endsAt: slotEnd,
      consultations: [
        {
          roomId: 'room-1',
          requestedStartsAt: new Date('2026-06-20T10:00:00'),
          requestedEndsAt: new Date('2026-06-20T10:30:00'),
        },
      ],
      sessions: [],
    }),
    false,
  )

  assert.equal(
    roomIsFree({
      room,
      startsAt: slotStart,
      endsAt: slotEnd,
      consultations: [],
      sessions: [
        {
          location: 'Japan',
          startsAt: new Date('2026-06-20T09:45:00'),
          endsAt: new Date('2026-06-20T10:15:00'),
        },
      ],
    }),
    false,
  )

  assert.equal(
    roomIsFree({
      room,
      startsAt: slotStart,
      endsAt: slotEnd,
      consultations: [],
      sessions: [
        {
          location: 'Vietnam',
          startsAt: new Date('2026-06-20T10:00:00'),
          endsAt: new Date('2026-06-20T11:00:00'),
        },
      ],
    }),
    true,
  )
})
