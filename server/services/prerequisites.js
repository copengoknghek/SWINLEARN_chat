import { getCurriculumForChildMajor } from './curriculum.js'
import {
  mapChildMajor,
  mapCourse,
  mapCourseRegistrationRequest,
  mapCoursePrerequisiteGroup,
  mapCoursePrerequisiteOption,
  mapCurriculumRule,
  mapOffering,
  mapStudentCourseCompletion,
  mapUserProfile,
} from '../mappers.js'
import { getPassedCourseIds } from './studentProgress.js'

const courseTitle = (course) => {
  if (!course) {
    return 'Unknown course'
  }

  return `${course.code} ${course.title}`.trim()
}

const courseCreditPoints = (course) => {
  const value = Number(course?.credit_points ?? course?.creditPoints ?? 0)

  return Number.isFinite(value) ? value : 0
}

const bySortOrder = (first, second) => Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0)

const sameStudyPeriod = (first, second) =>
  first?.term === second?.term && first?.academic_year === second?.academic_year

const getCourseIdFromOffering = (offering) => offering?.catalog_course_id ?? offering?.course_id ?? offering?.courseId

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

const getCompletedCourseIds = ({ student, completions }) => getPassedCourseIds(
  completions.filter(
    (completion) => completion.student_id === student?.id || completion.user_id === student?.id,
  ),
)

const getSelectedConcurrentCourseIds = ({ targetOffering, offeringsById, selectedOfferingIds }) =>
  new Set(
    selectedOfferingIds
      .map((offeringId) => offeringsById.get(offeringId))
      .filter((offering) => offering && offering.id !== targetOffering.id && sameStudyPeriod(offering, targetOffering))
      .map(getCourseIdFromOffering),
  )

const getEnrolledConcurrentCourseIds = ({ student, targetOffering, offeringsById, enrollments }) =>
  new Set(
    enrollments
      .filter((enrollment) => enrollment.user_id === student?.id || enrollment.student_id === student?.id)
      .map((enrollment) => offeringsById.get(enrollment.offering_id ?? enrollment.offeringId))
      .filter((offering) => offering && sameStudyPeriod(offering, targetOffering))
      .map(getCourseIdFromOffering),
  )

const optionIsMet = ({ option, completedCourseIds, enrolledConcurrentCourseIds, selectedConcurrentCourseIds }) => {
  const requiredCourseId = option.required_course_id ?? option.requiredCourseId

  if (completedCourseIds.has(requiredCourseId)) {
    return true
  }

  return (
    option.requirement_mode === 'passed_or_concurrent' &&
    (enrolledConcurrentCourseIds.has(requiredCourseId) || selectedConcurrentCourseIds.has(requiredCourseId))
  )
}

const creditRequirementMessage = (minimumCreditPoints, completedCreditPoints) =>
  `Need ${minimumCreditPoints} completed credit points in your curriculum; currently ${completedCreditPoints}.`

const courseRequirementMessage = ({ options, coursesById }) => {
  const labels = options.map((option) => courseTitle(coursesById.get(option.required_course_id))).join(' or ')
  const allowsConcurrent = options.some((option) => option.requirement_mode === 'passed_or_concurrent')

  return allowsConcurrent
    ? `Pass or concurrently enrol in ${labels}.`
    : `Pass one of ${labels}.`
}

export function evaluateCourseEligibility({
  student,
  targetOffering,
  childMajors,
  courses,
  curriculumRules,
  prerequisiteGroups,
  prerequisiteOptions,
  completions,
  enrollments,
  offerings,
  selectedOfferingIds = [],
}) {
  const targetCourseId = getCourseIdFromOffering(targetOffering)
  const courseGroups = prerequisiteGroups
    .filter((group) => group.course_id === targetCourseId)
    .sort(bySortOrder)
  const coursesById = new Map(courses.map((course) => [course.id, course]))
  const offeringsById = new Map(offerings.map((offering) => [offering.id, offering]))
  const curriculumCourseIds = getCurriculumCourseIds({ student, childMajors, courses, curriculumRules })
  const completedCourseIds = getCompletedCourseIds({ student, completions })
  const completedCreditPoints = [...completedCourseIds]
    .filter((courseId) => curriculumCourseIds.has(courseId))
    .reduce((total, courseId) => total + courseCreditPoints(coursesById.get(courseId)), 0)
  const enrolledConcurrentCourseIds = getEnrolledConcurrentCourseIds({
    student,
    targetOffering,
    offeringsById,
    enrollments,
  })
  const selectedConcurrentCourseIds = getSelectedConcurrentCourseIds({
    targetOffering,
    offeringsById,
    selectedOfferingIds,
  })
  const unmetRequirements = []

  for (const group of courseGroups) {
    if (group.requirement_type === 'completed_credit_points') {
      const minimumCreditPoints = Number(group.minimum_credit_points ?? 0)

      if (completedCreditPoints < minimumCreditPoints) {
        unmetRequirements.push({
          group_id: group.id,
          type: group.requirement_type,
          message: creditRequirementMessage(minimumCreditPoints, completedCreditPoints),
        })
      }

      continue
    }

    const options = prerequisiteOptions
      .filter((option) => option.group_id === group.id)
      .sort(bySortOrder)
    const groupMet = options.some((option) =>
      optionIsMet({
        option,
        completedCourseIds,
        enrolledConcurrentCourseIds,
        selectedConcurrentCourseIds,
      }),
    )

    if (!groupMet) {
      unmetRequirements.push({
        group_id: group.id,
        type: group.requirement_type,
        message: courseRequirementMessage({ options, coursesById }),
      })
    }
  }

  return {
    offering_id: targetOffering.id,
    course_id: targetCourseId,
    eligible: unmetRequirements.length === 0,
    completed_credit_points: completedCreditPoints,
    unmet_requirements: unmetRequirements,
  }
}

export function evaluateRegistrationBasket({
  selectedOfferingIds,
  offerings,
  ...context
}) {
  const selectedOfferings = selectedOfferingIds
    .map((offeringId) => offerings.find((offering) => offering.id === offeringId))
    .filter(Boolean)
  const results = selectedOfferings.map((targetOffering) =>
    evaluateCourseEligibility({
      ...context,
      targetOffering,
      offerings,
      selectedOfferingIds,
    }),
  )

  return {
    eligible: results.every((result) => result.eligible),
    results,
  }
}

export const prerequisiteFailureMessage = (result) =>
  result.unmet_requirements.map((requirement) => requirement.message).join(' ')

export async function loadPrerequisiteContext(prismaClient, studentId) {
  const [
    student,
    childMajors,
    courses,
    curriculumRules,
    prerequisiteGroups,
    prerequisiteOptions,
    completions,
    enrollments,
    registrationRequests,
    offerings,
  ] = await Promise.all([
    prismaClient.user.findUnique({ where: { id: studentId } }),
    prismaClient.childMajor.findMany(),
    prismaClient.course.findMany(),
    prismaClient.curriculumRule.findMany(),
    prismaClient.coursePrerequisiteGroup.findMany({ orderBy: { sortOrder: 'asc' } }),
    prismaClient.coursePrerequisiteOption.findMany({ orderBy: { sortOrder: 'asc' } }),
    prismaClient.studentCourseCompletion.findMany({ where: { studentId } }),
    prismaClient.enrollment.findMany({ where: { userId: studentId } }),
    prismaClient.courseRegistrationRequest.findMany({ where: { userId: studentId } }),
    prismaClient.courseOffering.findMany({
      include: {
        course: true,
        staff: true,
        enrollments: true,
      },
    }),
  ])

  return {
    student: student ? mapUserProfile(student) : null,
    childMajors: childMajors.map(mapChildMajor),
    courses: courses.map(mapCourse),
    curriculumRules: curriculumRules.map(mapCurriculumRule),
    prerequisiteGroups: prerequisiteGroups.map(mapCoursePrerequisiteGroup),
    prerequisiteOptions: prerequisiteOptions.map(mapCoursePrerequisiteOption),
    completions: completions.map(mapStudentCourseCompletion),
    enrollments: enrollments.map((enrollment) => ({
      id: enrollment.id,
      offering_id: enrollment.offeringId,
      user_id: enrollment.userId,
      created_at: enrollment.createdAt?.toISOString(),
    })),
    registrationRequests: registrationRequests.map(mapCourseRegistrationRequest),
    offerings: offerings.map(mapOffering),
  }
}
