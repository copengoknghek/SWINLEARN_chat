import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONSULTATION_TOPIC,
  buildConsultationEndsAt,
  parseConsultationDateTime,
  assertConsultationSlot,
  resolveHelpRequestType,
  sortTeachersRecommendedFirst,
} from './helpRequests.js'

test('resolveHelpRequestType maps book consultation topic', () => {
  assert.equal(resolveHelpRequestType(CONSULTATION_TOPIC), 'consultation')
  assert.equal(resolveHelpRequestType('Course access'), 'general')
})

test('parseConsultationDateTime builds local datetime from date and time', () => {
  const startsAt = parseConsultationDateTime('2026-06-20', '14:30')
  assert.equal(startsAt.getFullYear(), 2026)
  assert.equal(startsAt.getMonth(), 5)
  assert.equal(startsAt.getDate(), 20)
  assert.equal(startsAt.getHours(), 14)
  assert.equal(startsAt.getMinutes(), 30)
})

test('buildConsultationEndsAt adds 30 minutes', () => {
  const startsAt = new Date('2026-06-20T14:30:00')
  const endsAt = buildConsultationEndsAt(startsAt)
  assert.equal(endsAt.getTime() - startsAt.getTime(), 30 * 60 * 1000)
})

test('assertConsultationSlot rejects past slots and enforces business hours', () => {
  const now = new Date('2026-06-20T12:00:00')

  assert.throws(
    () =>
      assertConsultationSlot(
        new Date('2026-06-19T10:00:00'),
        new Date('2026-06-19T10:30:00'),
        now,
      ),
    (error) => error.statusCode === 400,
  )

  assert.throws(
    () =>
      assertConsultationSlot(
        new Date('2026-06-20T07:00:00'),
        new Date('2026-06-20T07:30:00'),
        now,
      ),
    (error) => error.statusCode === 400,
  )

  assert.doesNotThrow(() =>
    assertConsultationSlot(
      new Date('2026-06-20T14:00:00'),
      new Date('2026-06-20T14:30:00'),
      now,
    ),
  )
})

test('sortTeachersRecommendedFirst puts recommended teachers first', () => {
  const teachers = [
    { id: 't2', fullName: 'Zara' },
    { id: 't1', fullName: 'Anna' },
    { id: 't3', fullName: 'Ben' },
  ]

  const sorted = sortTeachersRecommendedFirst(teachers, ['t2', 't3'])
  assert.deepEqual(sorted.map((teacher) => teacher.id), ['t3', 't2', 't1'])
})
