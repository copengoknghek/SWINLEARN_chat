import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSwinlearnInstructions,
  isAssignmentCompletionRequest,
  isCvPortfolioRequest,
  isGradeExportRequest,
} from './swinlearnPrompt.js'

test('isGradeExportRequest detects grade export intent and phrases', () => {
  assert.equal(isGradeExportRequest('Export my grade table', 'grade_export'), true)
  assert.equal(isGradeExportRequest('Download my grades', ''), true)
  assert.equal(isGradeExportRequest('Show my grades report', ''), true)
  assert.equal(isGradeExportRequest('Show my grades', ''), true)
  assert.equal(isGradeExportRequest('xem bản điểm của tôi', ''), true)
  assert.equal(isGradeExportRequest('Summarize week 3', ''), false)
  assert.equal(isAssignmentCompletionRequest('Export my grades', ''), false)
})

test('buildSwinlearnInstructions supports empty knowledge pool', () => {
  const instructions = buildSwinlearnInstructions({
    courseLabels: [],
    knowledgePoolEmpty: true,
  })

  assert.match(instructions, /No courses selected for knowledge retrieval/)
  assert.match(instructions, /do not invent course-specific content/)
})

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

test('isCvPortfolioRequest bypasses assignment coaching for resume help', () => {
  assert.equal(isCvPortfolioRequest('Draft CV bullets from my submitted projects.'), true)
  assert.equal(isCvPortfolioRequest('Help me export a resume section from my GitHub work.'), true)
  assert.equal(isCvPortfolioRequest('Make a CV entry for "Capstone Project" in COS30034'), true)
  assert.equal(isCvPortfolioRequest('cv for week 5 in COS30043'), true)
  assert.equal(isAssignmentCompletionRequest('Draft CV bullets from my submitted projects.'), false)
})

test('isPerfectCvRequest detects perfect cv intent and phrases', async () => {
  const { isPerfectCvRequest } = await import('./swinlearnPrompt.js')

  assert.equal(isPerfectCvRequest('Build my Perfect CV from selected projects', 'perfect_cv'), true)
  assert.equal(isPerfectCvRequest('Make my whole CV', ''), true)
  assert.equal(isPerfectCvRequest('Summarize week 3', ''), false)
})

test('buildSwinlearnInstructions includes perfect cv experience-only rules', () => {
  const instructions = buildSwinlearnInstructions({
    courseLabels: ['COS30034 - ML Project'],
    cvMode: true,
    perfectCvMode: true,
  })

  assert.match(instructions, /Output only the ## Professional Experience section/)
  assert.match(instructions, /perfect_cv_profile source/)
  assert.doesNotMatch(instructions, /Included projects and Skipped/)
})

test('buildSwinlearnInstructions includes strict CV template in cv mode', () => {
  const instructions = buildSwinlearnInstructions({
    courseLabels: ['COS30034 - ML Project'],
    cvMode: true,
    scopedCourseCodes: ['COS30034'],
    scopeMode: 'message',
  })

  assert.match(instructions, /submitted assignment project/)
  assert.match(instructions, /Role: \[Frontend\|Backend\|Full Stack\|Data\/ML\|UI\/UX\|General\] \| Technologies:/)
  assert.match(instructions, /never use Student as the role/)
  assert.match(instructions, /GitHub:/)
  assert.match(instructions, /Never mention missing or absent features/)
  assert.ok(instructions.includes('**PROJECT NAME**'))
  assert.doesNotMatch(instructions, /Processed\/analyzed/)
})
