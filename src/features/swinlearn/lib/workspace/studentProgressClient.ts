import type {
  AcademicProgressData,
  ChildMajorRow,
  CourseCatalogRow,
  CurriculumRuleRow,
  ProfileRow,
  StudentCourseCompletionRow,
} from './types'
import { gradeFromScore, gradeLabel, isPassingScore } from './courseGrades'

const findChildMajor = (childMajors: ChildMajorRow[], childMajorId: string) =>
  childMajors.find((childMajor) => childMajor.id === childMajorId) ?? null

const ruleAppliesToChildMajor = (rule: CurriculumRuleRow, childMajor: ChildMajorRow) => {
  if (rule.scope === 'global') {
    return true
  }

  if (rule.scope === 'main_major') {
    return rule.main_major_id === childMajor.main_major_id
  }

  return rule.scope === 'child_major' && rule.child_major_id === childMajor.id
}

const getCurriculumCourseIds = ({
  profile,
  childMajors,
  courses,
  curriculumRules,
}: {
  profile: ProfileRow
  childMajors: ChildMajorRow[]
  courses: CourseCatalogRow[]
  curriculumRules: CurriculumRuleRow[]
}) => {
  if (!profile.child_major_id) {
    return new Set<string>()
  }

  const childMajor = findChildMajor(childMajors, profile.child_major_id)

  if (!childMajor) {
    return new Set<string>()
  }

  const coursesById = new Map(courses.map((course) => [course.id, course]))
  const curriculumIds = new Set<string>()

  for (const rule of curriculumRules) {
    if (!ruleAppliesToChildMajor(rule, childMajor)) {
      continue
    }

    if (coursesById.has(rule.course_id)) {
      curriculumIds.add(rule.course_id)
    }
  }

  return curriculumIds
}

export const buildStudentProgressForProfile = ({
  profile,
  courses,
  curriculumRules,
  childMajors,
  completions,
}: {
  profile: ProfileRow
  courses: CourseCatalogRow[]
  curriculumRules: CurriculumRuleRow[]
  childMajors: ChildMajorRow[]
  completions: StudentCourseCompletionRow[]
}): AcademicProgressData => {
  const coursesById = new Map(courses.map((course) => [course.id, course]))
  const curriculumCourseIds = getCurriculumCourseIds({
    profile,
    childMajors,
    courses,
    curriculumRules,
  })

  const completedCourses = completions
    .filter((completion) => completion.student_id === profile.id)
    .map((completion) => {
      const course = coursesById.get(completion.course_id)
      const finalScore = completion.final_score
      const grade = gradeFromScore(finalScore)
      const passing = isPassingScore(finalScore)
      const inCurriculum = curriculumCourseIds.has(completion.course_id)
      const creditPoints = course?.credit_points ?? 0
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
    .sort((left, right) => Date.parse(right.completed_at) - Date.parse(left.completed_at))

  return {
    total_credit_points: completedCourses.reduce(
      (total, course) => total + course.earned_credit_points,
      0,
    ),
    passed_course_count: completedCourses.filter((course) => course.counts_toward_total).length,
    completed_courses: completedCourses,
  }
}
