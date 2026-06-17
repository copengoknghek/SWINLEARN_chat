import type {
  ChildMajorRow,
  CourseMemberRole,
  CourseRegistrationRequestRow,
  CourseStatus,
  CourseTerm,
  CourseWithMembers,
  CurriculumRuleRow,
  MainMajorRow,
  ProfileRow,
} from '../../lib/workspace/types'

export type CourseOfferFilterValue = 'all'

export type CourseOfferFilters = {
  query: string
  status: CourseStatus | CourseOfferFilterValue
  term: CourseTerm | CourseOfferFilterValue
  academicYear: string
}

export type CourseOfferMemberCounts = Record<CourseMemberRole, number> & {
  total: number
}

const termRank: Record<CourseTerm, number> = {
  semester_1: 1,
  semester_2: 2,
  summer: 3,
}

const normalizeQuery = (value: string) => value.trim().toLowerCase()

export function getCourseTeachingMainMajorIds({
  courseId,
  mainMajors,
  childMajors,
  curriculumRules,
}: {
  courseId: string
  mainMajors: Pick<MainMajorRow, 'id'>[]
  childMajors: Pick<ChildMajorRow, 'id' | 'main_major_id'>[]
  curriculumRules: Pick<CurriculumRuleRow, 'course_id' | 'scope' | 'main_major_id' | 'child_major_id'>[]
}) {
  const allMainMajorIds = mainMajors.map((major) => major.id)
  const childToMainMajor = new Map(
    childMajors.map((childMajor) => [childMajor.id, childMajor.main_major_id]),
  )
  const teachingMainMajorIds = new Set<string>()

  for (const rule of curriculumRules) {
    if (rule.course_id !== courseId) {
      continue
    }

    if (rule.scope === 'global') {
      for (const mainMajorId of allMainMajorIds) {
        teachingMainMajorIds.add(mainMajorId)
      }
      continue
    }

    if (rule.scope === 'main_major' && rule.main_major_id) {
      teachingMainMajorIds.add(rule.main_major_id)
      continue
    }

    if (rule.scope === 'child_major' && rule.child_major_id) {
      const mainMajorId = childToMainMajor.get(rule.child_major_id)

      if (mainMajorId) {
        teachingMainMajorIds.add(mainMajorId)
      }
    }
  }

  return allMainMajorIds.filter((mainMajorId) => teachingMainMajorIds.has(mainMajorId))
}

export function getEligibleTeachersForCourse<
  T extends Pick<ProfileRow, 'role' | 'status' | 'main_major_id'>,
>({
  profiles,
  courseId,
  mainMajors,
  childMajors,
  curriculumRules,
}: {
  profiles: T[]
  courseId: string
  mainMajors: Pick<MainMajorRow, 'id'>[]
  childMajors: Pick<ChildMajorRow, 'id' | 'main_major_id'>[]
  curriculumRules: Pick<CurriculumRuleRow, 'course_id' | 'scope' | 'main_major_id' | 'child_major_id'>[]
}) {
  const teachingMainMajorIds = new Set(
    getCourseTeachingMainMajorIds({
      courseId,
      mainMajors,
      childMajors,
      curriculumRules,
    }),
  )

  if (teachingMainMajorIds.size === 0) {
    return []
  }

  return profiles.filter(
    (profile) =>
      profile.role === 'teacher' &&
      profile.status === 'active' &&
      profile.main_major_id !== null &&
      teachingMainMajorIds.has(profile.main_major_id),
  )
}

export function getCourseOfferMemberCounts(offering: CourseWithMembers): CourseOfferMemberCounts {
  const counts: CourseOfferMemberCounts = {
    teacher: 0,
    teaching_assistant: 0,
    student: 0,
    total: offering.members.length,
  }

  for (const member of offering.members) {
    counts[member.role] += 1
  }

  return counts
}

export function getCourseOfferAcademicYears(offerings: CourseWithMembers[]) {
  return Array.from(new Set(offerings.map((offering) => offering.academic_year)))
    .sort((first, second) => second - first)
}

export function getPendingRegistrationRequestsForOffering(
  requests: CourseRegistrationRequestRow[],
  offeringId: string,
) {
  return requests.filter(
    (request) => request.offering_id === offeringId && request.status === 'pending',
  )
}

export function sortCourseOfferings(offerings: CourseWithMembers[]) {
  return [...offerings].sort((first, second) => {
    if (first.academic_year !== second.academic_year) {
      return second.academic_year - first.academic_year
    }

    if (first.term !== second.term) {
      return termRank[first.term] - termRank[second.term]
    }

    return `${first.code} ${first.title}`.localeCompare(`${second.code} ${second.title}`)
  })
}

export function filterCourseOfferings(
  offerings: CourseWithMembers[],
  filters: CourseOfferFilters,
) {
  const query = normalizeQuery(filters.query)

  return sortCourseOfferings(offerings).filter((offering) => {
    const searchableText = normalizeQuery(`${offering.code} ${offering.title} ${offering.description}`)
    const matchesQuery = query === '' || searchableText.includes(query)
    const matchesStatus = filters.status === 'all' || offering.status === filters.status
    const matchesTerm = filters.term === 'all' || offering.term === filters.term
    const matchesYear =
      filters.academicYear === 'all' ||
      String(offering.academic_year) === filters.academicYear

    return matchesQuery && matchesStatus && matchesTerm && matchesYear
  })
}

export function resolveCourseOfferSelection({
  offerings,
  selectedOfferingId,
}: {
  offerings: CourseWithMembers[]
  selectedOfferingId: string
}) {
  if (selectedOfferingId && offerings.some((offering) => offering.id === selectedOfferingId)) {
    return selectedOfferingId
  }

  return offerings[0]?.id ?? ''
}
