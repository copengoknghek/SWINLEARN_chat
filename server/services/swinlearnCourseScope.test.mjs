import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildExcludedCourseMessage,
  isAssignmentListingQuestion,
  parseCourseCodesFromMessage,
  resolveMessageCourseScope,
} from './swinlearnCourseScope.js'

const offerings = [
  {
    course: { code: 'ICT20016', title: 'Work Integrated Learning Placement' },
    id: 'offering-ict',
  },
  {
    course: { code: 'COS10004', title: 'Computer Systems' },
    id: 'offering-cos',
  },
]

test('parseCourseCodesFromMessage finds enrolled course codes only', () => {
  assert.deepEqual(
    parseCourseCodesFromMessage('What about assignment in COS10004?', offerings),
    ['COS10004'],
  )
  assert.deepEqual(
    parseCourseCodesFromMessage('Compare ICT20016 and COS10004', offerings),
    ['ICT20016', 'COS10004'],
  )
  assert.deepEqual(parseCourseCodesFromMessage('What about XYZ99999?', offerings), [])
})

test('resolveMessageCourseScope scopes to mentioned courses in the pool', () => {
  const scope = resolveMessageCourseScope({
    message: 'List assignments in ICT20016',
    offerings,
    poolOfferingIds: ['offering-ict', 'offering-cos'],
  })

  assert.equal(scope.scopeMode, 'message')
  assert.deepEqual(scope.scopedOfferingIds, ['offering-ict'])
  assert.deepEqual(scope.courseCodes, ['ICT20016'])
})

test('resolveMessageCourseScope uses full pool when no course is named', () => {
  const scope = resolveMessageCourseScope({
    message: 'Summarize my selected courses',
    offerings,
    poolOfferingIds: ['offering-ict'],
  })

  assert.equal(scope.scopeMode, 'pool')
  assert.deepEqual(scope.scopedOfferingIds, ['offering-ict'])
})

test('resolveMessageCourseScope marks courses outside the pool as excluded', () => {
  const scope = resolveMessageCourseScope({
    message: 'What about assignment in COS10004?',
    offerings,
    poolOfferingIds: ['offering-ict'],
  })

  assert.equal(scope.scopeMode, 'excluded')
  assert.deepEqual(scope.excludedFromPool, ['COS10004'])
  assert.deepEqual(scope.scopedOfferingIds, [])
})

test('buildExcludedCourseMessage tells the student to add the course to the chat', () => {
  assert.match(buildExcludedCourseMessage(['COS10004']), /COS10004/)
  assert.match(buildExcludedCourseMessage(['COS10004']), /selected courses/i)
})

test('isAssignmentListingQuestion detects assignment listing prompts', () => {
  assert.equal(isAssignmentListingQuestion('can you list all the assignment exist in ICT20016'), true)
  assert.equal(isAssignmentListingQuestion('how many assignments are there?'), true)
  assert.equal(isAssignmentListingQuestion('explain gradient descent'), false)
})
