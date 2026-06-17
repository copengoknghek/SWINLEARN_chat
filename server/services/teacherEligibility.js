const field = (item, snakeName, camelName) => item?.[snakeName] ?? item?.[camelName] ?? null

const itemId = (item) => item?.id ?? null

const courseIdFromRule = (rule) => field(rule, 'course_id', 'courseId')

const mainMajorIdFromRule = (rule) => field(rule, 'main_major_id', 'mainMajorId')

const childMajorIdFromRule = (rule) => field(rule, 'child_major_id', 'childMajorId')

const mainMajorIdFromChild = (childMajor) => field(childMajor, 'main_major_id', 'mainMajorId')

const mainMajorIdFromTeacher = (teacher) => field(teacher, 'main_major_id', 'mainMajorId')

const userIdFromStaff = (staff) => field(staff, 'user_id', 'userId') ?? itemId(staff.user)

export function getCourseTeachingMainMajorIds({
  courseId,
  mainMajors,
  childMajors,
  curriculumRules,
}) {
  const allMainMajorIds = mainMajors.map((major) => major.id)
  const childToMainMajor = new Map(
    childMajors.map((childMajor) => [childMajor.id, mainMajorIdFromChild(childMajor)]),
  )
  const teachingMainMajorIds = new Set()

  for (const rule of curriculumRules) {
    if (courseIdFromRule(rule) !== courseId) {
      continue
    }

    if (rule.scope === 'global') {
      for (const mainMajorId of allMainMajorIds) {
        teachingMainMajorIds.add(mainMajorId)
      }
      continue
    }

    if (rule.scope === 'main_major') {
      const mainMajorId = mainMajorIdFromRule(rule)

      if (mainMajorId) {
        teachingMainMajorIds.add(mainMajorId)
      }
      continue
    }

    if (rule.scope === 'child_major') {
      const mainMajorId = childToMainMajor.get(childMajorIdFromRule(rule))

      if (mainMajorId) {
        teachingMainMajorIds.add(mainMajorId)
      }
    }
  }

  return allMainMajorIds.filter((mainMajorId) => teachingMainMajorIds.has(mainMajorId))
}

export function getTeacherCourseEligibilityError({
  teacher,
  courseId,
  mainMajors,
  childMajors,
  curriculumRules,
}) {
  if (!teacher || teacher.role !== 'teacher') {
    return 'Only teacher profiles can be assigned to a teaching team.'
  }

  if (teacher.status !== 'active') {
    return 'Only active teachers can be assigned to a teaching team.'
  }

  const teacherMainMajorId = mainMajorIdFromTeacher(teacher)

  if (!teacherMainMajorId) {
    return 'Teacher profiles must have a main major before they can teach a course.'
  }

  const teachingMainMajorIds = getCourseTeachingMainMajorIds({
    courseId,
    mainMajors,
    childMajors,
    curriculumRules,
  })

  if (teachingMainMajorIds.length === 0) {
    return 'Course must be assigned to a main major before teachers can be assigned.'
  }

  if (!teachingMainMajorIds.includes(teacherMainMajorId)) {
    return 'Teacher main major does not match this course.'
  }

  return ''
}

export function getIneligibleStaffForCourse({
  staff,
  courseId,
  mainMajors,
  childMajors,
  curriculumRules,
}) {
  return staff.flatMap((staffMember) => {
    const teacher = staffMember.user ?? staffMember
    const reason = getTeacherCourseEligibilityError({
      teacher,
      courseId,
      mainMajors,
      childMajors,
      curriculumRules,
    })

    if (!reason) {
      return []
    }

    return [
      {
        staff_id: staffMember.id,
        user_id: userIdFromStaff(staffMember),
        reason,
      },
    ]
  })
}
