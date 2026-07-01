import { getCurriculumForChildMajor } from './curriculum.js'
import { gradeFromScore, gradeLabel, isPassingScore } from './courseGrades.js'

const courseCreditPoints = (course) => {
  const value = Number(course?.credit_points ?? course?.creditPoints ?? 0)

  return Number.isFinite(value) ? value : 0
}

const getCurriculumCourseIds = ({ student, childMajors, courses, curriculumRules }) => {
  if (!student?.child_major_id) {
    return new Set()
  }

  const curriculum = getCurriculumForChildMajor({
    childMajorId: student.child_major_id,
    childMajors,
    courses,
    rules: curriculumRules,
  })

  return new Set([...curriculum.required, ...curriculum.electives].map((course) => course.id))
}

export const buildStudentProgress = ({
  student,
  courses,
  curriculumRules,
  childMajors,
  completions,
}) => {
  const coursesById = new Map(courses.map((course) => [course.id, course]))
  const curriculumCourseIds = getCurriculumCourseIds({ student, childMajors, courses, curriculumRules })

  const completedCourses = completions
    .filter((completion) => completion.student_id === student?.id)
    .map((completion) => {
      const course = coursesById.get(completion.course_id)
      const finalScore = Number(completion.final_score ?? 50)
      const grade = gradeFromScore(finalScore)
      const passing = isPassingScore(finalScore)
      const inCurriculum = curriculumCourseIds.has(completion.course_id)
      const creditPoints = courseCreditPoints(course)
      const countsTowardTotal = passing && inCurriculum

      return {
        id: completion.id,
        course_id: completion.course_id,
        code: course?.code ?? '',
        title: course?.title ?? 'Completed course',
        final_score: finalScore,
        grade,
        grade_label: grade ? gradeLabel(grade) : null,
        credit_points: creditPoints,
        counts_toward_total: countsTowardTotal,
        earned_credit_points: countsTowardTotal ? creditPoints : 0,
        completed_at: completion.completed_at,
      }
    })
    .sort((left, right) => {
      const leftTime = left.completed_at ? Date.parse(left.completed_at) : 0
      const rightTime = right.completed_at ? Date.parse(right.completed_at) : 0

      return rightTime - leftTime
    })

  const totalCreditPoints = completedCourses.reduce(
    (total, course) => total + course.earned_credit_points,
    0,
  )
  const passedCourseCount = completedCourses.filter((course) => course.counts_toward_total).length

  return {
    total_credit_points: totalCreditPoints,
    passed_course_count: passedCourseCount,
    completed_courses: completedCourses,
  }
}

export const getPassedCourseIds = (completions) =>
  new Set(
    completions
      .filter((completion) => isPassingScore(completion.final_score ?? 50))
      .map((completion) => completion.course_id ?? completion.courseId),
  )
