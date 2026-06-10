import test from 'node:test'
import assert from 'node:assert/strict'

import { getCurriculumForChildMajor } from './curriculum.js'

const mainMajors = [
  { id: 'cs', title: 'Computer Science' },
  { id: 'business', title: 'Business' },
]

const childMajors = [
  { id: 'ai', main_major_id: 'cs', title: 'Artificial Intelligence' },
  { id: 'software', main_major_id: 'cs', title: 'Software Development' },
  { id: 'marketing', main_major_id: 'business', title: 'Marketing' },
]

const courses = [
  { id: 'cloud', code: 'COS20019', title: 'Cloud Computing Architecture' },
  { id: 'ai-course', code: 'COS30019', title: 'Introduction to Artificial Intelligence' },
  { id: 'patterns', code: 'COS30008', title: 'Data Structures and Patterns' },
]

const rules = [
  {
    id: 'cs-core-cloud',
    course_id: 'cloud',
    rule_type: 'core',
    scope: 'main_major',
    main_major_id: 'cs',
    child_major_id: null,
  },
  {
    id: 'ai-major-ai-course',
    course_id: 'ai-course',
    rule_type: 'major',
    scope: 'child_major',
    main_major_id: null,
    child_major_id: 'ai',
  },
  {
    id: 'software-elective-ai-course',
    course_id: 'ai-course',
    rule_type: 'elective',
    scope: 'child_major',
    main_major_id: null,
    child_major_id: 'software',
  },
  {
    id: 'global-elective-patterns',
    course_id: 'patterns',
    rule_type: 'elective',
    scope: 'global',
    main_major_id: null,
    child_major_id: null,
  },
]

test('core courses apply to every child major in the same main major only', () => {
  const csAi = getCurriculumForChildMajor({
    childMajorId: 'ai',
    childMajors,
    courses,
    rules,
  })
  const businessMarketing = getCurriculumForChildMajor({
    childMajorId: 'marketing',
    childMajors,
    courses,
    rules,
  })

  assert.equal(csAi.required.some((course) => course.code === 'COS20019'), true)
  assert.equal(businessMarketing.required.some((course) => course.code === 'COS20019'), false)
})

test('a course can be major for one child major and elective for another', () => {
  const aiCurriculum = getCurriculumForChildMajor({
    childMajorId: 'ai',
    childMajors,
    courses,
    rules,
  })
  const softwareCurriculum = getCurriculumForChildMajor({
    childMajorId: 'software',
    childMajors,
    courses,
    rules,
  })

  assert.equal(aiCurriculum.required.some((course) => course.code === 'COS30019'), true)
  assert.equal(aiCurriculum.electives.some((course) => course.code === 'COS30019'), false)
  assert.equal(softwareCurriculum.required.some((course) => course.code === 'COS30019'), false)
  assert.equal(softwareCurriculum.electives.some((course) => course.code === 'COS30019'), true)
})

test('global electives are visible to every child major', () => {
  for (const childMajor of childMajors) {
    const curriculum = getCurriculumForChildMajor({
      childMajorId: childMajor.id,
      childMajors,
      courses,
      rules,
    })

    assert.equal(curriculum.electives.some((course) => course.code === 'COS30008'), true)
  }
})
