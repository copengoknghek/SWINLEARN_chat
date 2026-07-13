import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSwinlearnInstructions,
  isAssignmentCompletionRequest,
} from './swinlearnPrompt.js'

test('buildSwinlearnInstructions enforces enrolled-course and Socratic tutor boundaries', () => {
  const instructions = buildSwinlearnInstructions({
    courseLabels: ['COS10001 - Introduction to Programming'],
    scopedCourseCodes: ['COS10001'],
    scopeMode: 'message',
  })

  assert.match(instructions, /enrolled course/i)
  assert.match(instructions, /COS10001 - Introduction to Programming/)
  assert.match(instructions, /COS10001/)
  assert.match(instructions, /do not.*assignment/i)
  assert.match(instructions, /Socratic/i)
  assert.match(instructions, /cite/i)
  assert.match(instructions, /Do not invent modules/i)
  assert.match(instructions, /Never reuse facts from earlier chat messages/i)
  assert.match(instructions, /Do not attribute assignments/i)
})

test('isAssignmentCompletionRequest detects requests for submit-ready work', () => {
  assert.equal(isAssignmentCompletionRequest('Write my assignment essay about ML.'), true)
  assert.equal(isAssignmentCompletionRequest('Give me the final answer for question 4.'), true)
  assert.equal(isAssignmentCompletionRequest('Can you solve my homework completely?'), true)
  assert.equal(isAssignmentCompletionRequest('Explain what supervised learning means.'), false)
  assert.equal(isAssignmentCompletionRequest('Where in my course is regression explained?'), false)
})
