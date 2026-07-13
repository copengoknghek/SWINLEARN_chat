import {
  calculateGpa,
  DEGREE_CREDIT_POINTS,
  groupCoursesByGradeBand,
  REQUIRED_PASSING_COURSES,
} from './gradeProgressMetrics.mjs'

/** @param {import('./workspace/types.ts').AcademicProgressData} report */
export const buildGradeWarningDetail = (report) => {
  const courses = report?.completed_courses ?? []
  const groups = groupCoursesByGradeBand(courses)
  const earnedCreditPoints = report?.total_credit_points ?? 0
  const passedCourseCount = report?.passed_course_count ?? 0

  return {
    total_courses_studied: courses.length,
    fail_courses: groups.fail,
    pass_courses: groups.pass,
    distinction_courses: groups.distinction,
    earned_credit_points: earnedCreditPoints,
    degree_credit_points: DEGREE_CREDIT_POINTS,
    passed_course_count: passedCourseCount,
    required_passing_courses: REQUIRED_PASSING_COURSES,
    remaining_courses: Math.max(0, REQUIRED_PASSING_COURSES - passedCourseCount),
    remaining_credit_points: Math.max(0, DEGREE_CREDIT_POINTS - earnedCreditPoints),
    gpa: calculateGpa(courses),
  }
}
