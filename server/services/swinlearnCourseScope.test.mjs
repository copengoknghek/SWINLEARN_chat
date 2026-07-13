import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildExcludedCourseMessage,
  detectSubmittedAssignmentThreadContext,
  extractCourseCodeFromSubmittedAssignmentHistory,
  isAssignmentListingQuestion,
  isSubmittedAssignmentFollowUp,
  isSubmittedAssignmentQuestion,
  isSubmittedAssignmentThreadReply,
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
  assert.equal(isAssignmentListingQuestion('how many assignment that i submited'), false)
  assert.equal(isAssignmentListingQuestion('how many assignments have I submitted?'), false)
})

test('isSubmittedAssignmentQuestion detects submission status prompts', () => {
  assert.equal(isSubmittedAssignmentQuestion('what assignment i already submit in this course'), true)
  assert.equal(isSubmittedAssignmentQuestion('which assignments have I submitted in COS30043?'), true)
  assert.equal(isSubmittedAssignmentQuestion('list my submitted assignments'), true)
  assert.equal(isSubmittedAssignmentQuestion('how many assignment that i submited'), true)
  assert.equal(isSubmittedAssignmentQuestion('how many assignments have I submitted in COS30043?'), true)
  assert.equal(isSubmittedAssignmentQuestion('i mean week 5'), false)
  assert.equal(isSubmittedAssignmentQuestion('Make a CV entry for Week 5 in COS30043'), false)
})

test('isSubmittedAssignmentThreadReply recognizes submitted assignment answers', () => {
  assert.equal(
    isSubmittedAssignmentThreadReply('In COS30043, you\'ve submitted one assignment so far: "Assignment 1".'),
    true,
  )
  assert.equal(
    isSubmittedAssignmentThreadReply('I checked COS30043 and don\'t see any submitted assignments on your account yet.'),
    true,
  )
  assert.equal(
    isSubmittedAssignmentThreadReply('Yes — so far you\'ve only submitted one assignment in COS30043: "Assignment 1".'),
    true,
  )
  assert.equal(isSubmittedAssignmentThreadReply('Assignments in COS30043:\n1. Week 5'), false)
})

test('detectSubmittedAssignmentThreadContext finds recent submitted-assignment replies', () => {
  const history = [
    { role: 'student', content: 'how many assignment i submited' },
    {
      role: 'assistant',
      content: 'In COS30043, you\'ve submitted one assignment so far: "Assignment 1".',
      metadata: { contentType: 'submitted_assignments', courseCode: 'COS30043' },
    },
  ]

  assert.equal(detectSubmittedAssignmentThreadContext(history), true)
})

test('isSubmittedAssignmentFollowUp confirms submission counts in thread', () => {
  const history = [
    { role: 'student', content: 'how many assignment i submited' },
    {
      role: 'assistant',
      content: 'In COS30043, you\'ve submitted one assignment so far: "Assignment 1".',
      metadata: { contentType: 'submitted_assignments', courseCode: 'COS30043' },
    },
  ]

  assert.equal(isSubmittedAssignmentFollowUp('only 1?', history), true)
  assert.equal(isSubmittedAssignmentFollowUp('just only 1?', history), true)
  assert.equal(isSubmittedAssignmentFollowUp('just one?', history), true)
  assert.equal(isSubmittedAssignmentFollowUp('are you sure?', history), true)
  assert.equal(isSubmittedAssignmentFollowUp('only 1?', []), false)
  assert.equal(isSubmittedAssignmentQuestion('only 1?', history), true)
})

test('extractCourseCodeFromSubmittedAssignmentHistory reads course from reply metadata', () => {
  const history = [
    {
      role: 'assistant',
      content: 'In COS30043, you\'ve submitted one assignment so far: "Assignment 1".',
      metadata: { contentType: 'submitted_assignments', courseCode: 'COS30043' },
    },
  ]

  assert.equal(extractCourseCodeFromSubmittedAssignmentHistory(history), 'COS30043')
})
