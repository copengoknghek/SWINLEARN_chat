import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCourseTeachingMainMajorIds,
  getTeacherCourseEligibilityError,
  getIneligibleStaffForCourse,
} from './teacherEligibility.js'

const mainMajors = [
  { id: 'cs', title: 'Computer Science' },
  { id: 'business', title: 'Business' },
  { id: 'media', title: 'Media' },
]

const childMajors = [
  { id: 'software', main_major_id: 'cs', title: 'Software Development' },
  { id: 'marketing', main_major_id: 'business', title: 'Marketing' },
]

const curriculumRules = [
  {
    course_id: 'global-course',
    scope: 'global',
    main_major_id: null,
    child_major_id: null,
  },
  {
    course_id: 'main-course',
    scope: 'main_major',
    main_major_id: 'cs',
    child_major_id: null,
  },
  {
    course_id: 'child-course',
    scope: 'child_major',
    main_major_id: null,
    child_major_id: 'marketing',
  },
  {
    course_id: 'multi-course',
    scope: 'main_major',
    main_major_id: 'cs',
    child_major_id: null,
  },
  {
    course_id: 'multi-course',
    scope: 'child_major',
    main_major_id: null,
    child_major_id: 'marketing',
  },
]

const eligibleTeacher = {
  id: 'teacher-cs',
  role: 'teacher',
  status: 'active',
  main_major_id: 'cs',
}

test('course teaching majors are derived from global, main-major, and child-major rules', () => {
  assert.deepEqual(
    getCourseTeachingMainMajorIds({
      courseId: 'global-course',
      mainMajors,
      childMajors,
      curriculumRules,
    }),
    ['cs', 'business', 'media'],
  )

  assert.deepEqual(
    getCourseTeachingMainMajorIds({
      courseId: 'main-course',
      mainMajors,
      childMajors,
      curriculumRules,
    }),
    ['cs'],
  )

  assert.deepEqual(
    getCourseTeachingMainMajorIds({
      courseId: 'child-course',
      mainMajors,
      childMajors,
      curriculumRules,
    }),
    ['business'],
  )

  assert.deepEqual(
    getCourseTeachingMainMajorIds({
      courseId: 'multi-course',
      mainMajors,
      childMajors,
      curriculumRules,
    }),
    ['cs', 'business'],
  )
})

test('teacher eligibility requires active teacher role and matching main major', () => {
  const context = {
    courseId: 'main-course',
    mainMajors,
    childMajors,
    curriculumRules,
  }

  assert.equal(
    getTeacherCourseEligibilityError({
      ...context,
      teacher: eligibleTeacher,
    }),
    '',
  )

  assert.equal(
    getTeacherCourseEligibilityError({
      ...context,
      teacher: {
        ...eligibleTeacher,
        role: 'student',
      },
    }),
    'Only teacher profiles can be assigned to a teaching team.',
  )

  assert.equal(
    getTeacherCourseEligibilityError({
      ...context,
      teacher: {
        ...eligibleTeacher,
        status: 'inactive',
      },
    }),
    'Only active teachers can be assigned to a teaching team.',
  )

  assert.equal(
    getTeacherCourseEligibilityError({
      ...context,
      teacher: {
        ...eligibleTeacher,
        main_major_id: null,
      },
    }),
    'Teacher profiles must have a main major before they can teach a course.',
  )

  assert.equal(
    getTeacherCourseEligibilityError({
      ...context,
      teacher: {
        ...eligibleTeacher,
        main_major_id: 'business',
      },
    }),
    'Teacher main major does not match this course.',
  )
})

test('staff validation reports existing teachers who cannot teach a changed course', () => {
  const invalidStaff = getIneligibleStaffForCourse({
    staff: [
      {
        id: 'staff-cs',
        user: eligibleTeacher,
      },
      {
        id: 'staff-business',
        user: {
          ...eligibleTeacher,
          id: 'teacher-business',
          main_major_id: 'business',
        },
      },
    ],
    courseId: 'main-course',
    mainMajors,
    childMajors,
    curriculumRules,
  })

  assert.deepEqual(invalidStaff, [
    {
      staff_id: 'staff-business',
      user_id: 'teacher-business',
      reason: 'Teacher main major does not match this course.',
    },
  ])
})
