import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateCourseEligibility,
  evaluateRegistrationBasket,
} from './prerequisites.js'

const student = {
  id: 'student-1',
  child_major_id: 'software-development',
}

const childMajors = [
  {
    id: 'software-development',
    main_major_id: 'cs',
    title: 'Software Development',
    summary: '',
    sort_order: 1,
  },
]

const courses = [
  {
    id: 'intro-programming',
    code: 'COS10009',
    title: 'Introduction to Programming',
    description: '',
    credit_points: 12.5,
  },
  {
    id: 'data-systems',
    code: 'ENG10004',
    title: 'Digital and Data Systems',
    description: '',
    credit_points: 12.5,
  },
  {
    id: 'problem-solving',
    code: 'ICT10001',
    title: 'Problem Solving with ICT',
    description: '',
    credit_points: 12.5,
  },
  {
    id: 'advanced-project',
    code: 'COS30099',
    title: 'Advanced Project',
    description: '',
    credit_points: 12.5,
  },
  {
    id: 'outside-curriculum',
    code: 'MKT10001',
    title: 'Marketing Foundations',
    description: '',
    credit_points: 25,
  },
]

const curriculumRules = [
  {
    id: 'rule-intro',
    course_id: 'intro-programming',
    rule_type: 'core',
    scope: 'main_major',
    scope_key: 'cs',
    main_major_id: 'cs',
    child_major_id: null,
  },
  {
    id: 'rule-data-systems',
    course_id: 'data-systems',
    rule_type: 'major',
    scope: 'child_major',
    scope_key: 'software-development',
    main_major_id: null,
    child_major_id: 'software-development',
  },
  {
    id: 'rule-problem-solving',
    course_id: 'problem-solving',
    rule_type: 'elective',
    scope: 'global',
    scope_key: 'global',
    main_major_id: null,
    child_major_id: null,
  },
  {
    id: 'rule-advanced',
    course_id: 'advanced-project',
    rule_type: 'major',
    scope: 'child_major',
    scope_key: 'software-development',
    main_major_id: null,
    child_major_id: 'software-development',
  },
]

const offerings = [
  {
    id: 'offering-intro-s1',
    catalog_course_id: 'intro-programming',
    term: 'semester_1',
    academic_year: 2026,
  },
  {
    id: 'offering-data-systems-s1',
    catalog_course_id: 'data-systems',
    term: 'semester_1',
    academic_year: 2026,
  },
  {
    id: 'offering-advanced-s1',
    catalog_course_id: 'advanced-project',
    term: 'semester_1',
    academic_year: 2026,
  },
]

const baseContext = {
  student,
  childMajors,
  courses,
  curriculumRules,
  prerequisiteGroups: [],
  prerequisiteOptions: [],
  completions: [],
  enrollments: [],
  offerings,
}

test('course with no prerequisite groups is eligible', () => {
  const result = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[0],
  })

  assert.equal(result.eligible, true)
  assert.deepEqual(result.unmet_requirements, [])
})

test('minimum curriculum credit points must be completed inside the student curriculum', () => {
  const result = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    prerequisiteGroups: [
      {
        id: 'credits-25',
        course_id: 'advanced-project',
        requirement_type: 'completed_credit_points',
        minimum_credit_points: 25,
        sort_order: 0,
      },
    ],
    completions: [
      {
        id: 'complete-intro',
        student_id: student.id,
        course_id: 'intro-programming',
      },
      {
        id: 'complete-outside',
        student_id: student.id,
        course_id: 'outside-curriculum',
      },
    ],
  })

  assert.equal(result.eligible, false)
  assert.equal(result.completed_credit_points, 12.5)
  assert.match(result.unmet_requirements[0].message, /Need 25 completed credit points/)
})

test('passed course alternatives satisfy one option in a prerequisite group', () => {
  const result = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    prerequisiteGroups: [
      {
        id: 'foundation-course',
        course_id: 'advanced-project',
        requirement_type: 'course_alternatives',
        minimum_credit_points: null,
        sort_order: 0,
      },
    ],
    prerequisiteOptions: [
      {
        id: 'option-data',
        group_id: 'foundation-course',
        required_course_id: 'data-systems',
        requirement_mode: 'passed',
        sort_order: 0,
      },
      {
        id: 'option-problem',
        group_id: 'foundation-course',
        required_course_id: 'problem-solving',
        requirement_mode: 'passed',
        sort_order: 1,
      },
    ],
    completions: [
      {
        id: 'complete-problem',
        student_id: student.id,
        course_id: 'problem-solving',
      },
    ],
  })

  assert.equal(result.eligible, true)
  assert.deepEqual(result.unmet_requirements, [])
})

test('concurrent prerequisite passes from an existing same-term enrollment', () => {
  const result = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    prerequisiteGroups: [
      {
        id: 'programming',
        course_id: 'advanced-project',
        requirement_type: 'course_alternatives',
        minimum_credit_points: null,
        sort_order: 0,
      },
    ],
    prerequisiteOptions: [
      {
        id: 'option-intro',
        group_id: 'programming',
        required_course_id: 'intro-programming',
        requirement_mode: 'passed_or_concurrent',
        sort_order: 0,
      },
    ],
    enrollments: [
      {
        id: 'enrollment-intro',
        user_id: student.id,
        offering_id: 'offering-intro-s1',
      },
    ],
  })

  assert.equal(result.eligible, true)
})

test('concurrent prerequisite passes from a selected basket offering', () => {
  const result = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    selectedOfferingIds: ['offering-intro-s1', 'offering-advanced-s1'],
    prerequisiteGroups: [
      {
        id: 'programming',
        course_id: 'advanced-project',
        requirement_type: 'course_alternatives',
        minimum_credit_points: null,
        sort_order: 0,
      },
    ],
    prerequisiteOptions: [
      {
        id: 'option-intro',
        group_id: 'programming',
        required_course_id: 'intro-programming',
        requirement_mode: 'passed_or_concurrent',
        sort_order: 0,
      },
    ],
  })

  assert.equal(result.eligible, true)
})

test('course alternatives can be satisfied by a concurrent selected offering', () => {
  const result = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    selectedOfferingIds: ['offering-data-systems-s1', 'offering-advanced-s1'],
    prerequisiteGroups: [
      {
        id: 'ai-alternatives',
        course_id: 'advanced-project',
        requirement_type: 'course_alternatives',
        minimum_credit_points: null,
        sort_order: 0,
      },
    ],
    prerequisiteOptions: [
      {
        id: 'option-data',
        group_id: 'ai-alternatives',
        required_course_id: 'data-systems',
        requirement_mode: 'passed_or_concurrent',
        sort_order: 0,
      },
      {
        id: 'option-problem',
        group_id: 'ai-alternatives',
        required_course_id: 'problem-solving',
        requirement_mode: 'passed_or_concurrent',
        sort_order: 1,
      },
    ],
  })

  assert.equal(result.eligible, true)
  assert.deepEqual(result.unmet_requirements, [])
})

test('mixed course and credit prerequisites require every group', () => {
  const satisfiedResult = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    prerequisiteGroups: [
      {
        id: 'intro-course',
        course_id: 'advanced-project',
        requirement_type: 'course_alternatives',
        minimum_credit_points: null,
        sort_order: 0,
      },
      {
        id: 'credits-25',
        course_id: 'advanced-project',
        requirement_type: 'completed_credit_points',
        minimum_credit_points: 25,
        sort_order: 1,
      },
    ],
    prerequisiteOptions: [
      {
        id: 'option-intro',
        group_id: 'intro-course',
        required_course_id: 'intro-programming',
        requirement_mode: 'passed',
        sort_order: 0,
      },
    ],
    completions: [
      {
        id: 'complete-intro',
        student_id: student.id,
        course_id: 'intro-programming',
      },
      {
        id: 'complete-data',
        student_id: student.id,
        course_id: 'data-systems',
      },
    ],
  })

  assert.equal(satisfiedResult.eligible, true)
  assert.deepEqual(satisfiedResult.unmet_requirements, [])

  const missingCreditsResult = evaluateCourseEligibility({
    ...baseContext,
    targetOffering: offerings[2],
    prerequisiteGroups: [
      {
        id: 'intro-course',
        course_id: 'advanced-project',
        requirement_type: 'course_alternatives',
        minimum_credit_points: null,
        sort_order: 0,
      },
      {
        id: 'credits-25',
        course_id: 'advanced-project',
        requirement_type: 'completed_credit_points',
        minimum_credit_points: 25,
        sort_order: 1,
      },
    ],
    prerequisiteOptions: [
      {
        id: 'option-intro',
        group_id: 'intro-course',
        required_course_id: 'intro-programming',
        requirement_mode: 'passed',
        sort_order: 0,
      },
    ],
    completions: [
      {
        id: 'complete-intro',
        student_id: student.id,
        course_id: 'intro-programming',
      },
    ],
  })

  assert.equal(missingCreditsResult.eligible, false)
  assert.deepEqual(
    missingCreditsResult.unmet_requirements.map((requirement) => requirement.type),
    ['completed_credit_points'],
  )
})

test('registration basket reports all selected offerings and blocks ineligible selections', () => {
  const result = evaluateRegistrationBasket({
    ...baseContext,
    selectedOfferingIds: ['offering-data-systems-s1', 'offering-advanced-s1'],
    prerequisiteGroups: [
      {
        id: 'advanced-credits',
        course_id: 'advanced-project',
        requirement_type: 'completed_credit_points',
        minimum_credit_points: 25,
        sort_order: 0,
      },
    ],
  })

  assert.equal(result.eligible, false)
  assert.deepEqual(
    result.results.map((item) => [item.offering_id, item.eligible]),
    [
      ['offering-data-systems-s1', true],
      ['offering-advanced-s1', false],
    ],
  )
})
