import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateCourseEligibility } from './prerequisites.js'
import { buildStudentProgress } from './studentProgress.js'

const student = {
  id: 'student-1',
  child_major_id: 'child-1',
}

const childMajors = [
  {
    id: 'child-1',
    main_major_id: 'main-1',
    title: 'AI',
  },
]

const courses = [
  { id: 'course-a', code: 'COS10009', title: 'Intro', credit_points: 12.5 },
  { id: 'course-b', code: 'COS20007', title: 'OOP', credit_points: 12.5 },
  { id: 'course-x', code: 'OTHER01', title: 'Outside', credit_points: 12.5 },
]

const curriculumRules = [
  {
    course_id: 'course-a',
    scope: 'child_major',
    child_major_id: 'child-1',
    main_major_id: null,
    rule_type: 'core',
  },
  {
    course_id: 'course-b',
    scope: 'child_major',
    child_major_id: 'child-1',
    main_major_id: null,
    rule_type: 'major',
  },
]

describe('studentProgress', () => {
  it('counts only passing curriculum courses toward total credit', () => {
    const progress = buildStudentProgress({
      student,
      courses,
      curriculumRules,
      childMajors,
      completions: [
        { id: 'c1', student_id: 'student-1', course_id: 'course-a', final_score: 72, completed_at: '2026-01-01' },
        { id: 'c2', student_id: 'student-1', course_id: 'course-b', final_score: 45, completed_at: '2026-01-02' },
        { id: 'c3', student_id: 'student-1', course_id: 'course-x', final_score: 80, completed_at: '2026-01-03' },
      ],
    })

    assert.equal(progress.total_credit_points, 12.5)
    assert.equal(progress.passed_course_count, 1)
    assert.equal(progress.completed_courses.length, 3)
    assert.equal(progress.completed_courses[0].grade, 'HD')
    assert.equal(progress.completed_courses[1].counts_toward_total, false)
  })
})

describe('prerequisites pass-only completions', () => {
  it('does not treat failed completions as passed prerequisites', () => {
    const targetOffering = {
      id: 'offering-1',
      course_id: 'course-b',
      term: 'semester_1',
      academic_year: 2026,
    }

    const result = evaluateCourseEligibility({
      student,
      targetOffering,
      childMajors,
      courses,
      curriculumRules,
      prerequisiteGroups: [
        {
          id: 'group-1',
          course_id: 'course-b',
          requirement_type: 'course_alternatives',
          sort_order: 0,
        },
      ],
      prerequisiteOptions: [
        {
          id: 'option-1',
          group_id: 'group-1',
          required_course_id: 'course-a',
          requirement_mode: 'passed',
          sort_order: 0,
        },
      ],
      completions: [
        { student_id: 'student-1', course_id: 'course-a', final_score: 40 },
      ],
      enrollments: [],
      offerings: [targetOffering],
      selectedOfferingIds: [],
    })

    assert.equal(result.eligible, false)
    assert.equal(result.completed_credit_points, 0)
  })

  it('counts passing completions toward credit prerequisites', () => {
    const targetOffering = {
      id: 'offering-1',
      course_id: 'course-b',
      term: 'semester_1',
      academic_year: 2026,
    }

    const result = evaluateCourseEligibility({
      student,
      targetOffering,
      childMajors,
      courses,
      curriculumRules,
      prerequisiteGroups: [
        {
          id: 'group-1',
          course_id: 'course-b',
          requirement_type: 'completed_credit_points',
          minimum_credit_points: 12.5,
          sort_order: 0,
        },
      ],
      prerequisiteOptions: [],
      completions: [
        { student_id: 'student-1', course_id: 'course-a', final_score: 55 },
      ],
      enrollments: [],
      offerings: [targetOffering],
      selectedOfferingIds: [],
    })

    assert.equal(result.eligible, true)
    assert.equal(result.completed_credit_points, 12.5)
  })
})
