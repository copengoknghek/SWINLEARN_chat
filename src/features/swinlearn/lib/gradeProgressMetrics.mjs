export const DEGREE_CREDIT_POINTS = 300
export const CREDITS_PER_COURSE = 12.5
export const REQUIRED_PASSING_COURSES = 24

const GRADE_POINTS = {
  F: 0,
  P: 1,
  C: 2,
  D: 3,
  HD: 4,
}

export const gradePointForGrade = (grade) => GRADE_POINTS[grade] ?? null

export const calculateGpa = (courses) => {
  const credited = (courses ?? []).filter((course) => course.counts_toward_total)

  if (credited.length === 0) {
    return 0
  }

  let totalPoints = 0
  let totalCredits = 0

  for (const course of credited) {
    const gradePoint = gradePointForGrade(course.grade)

    if (gradePoint === null) {
      continue
    }

    const creditPoints = course.earned_credit_points ?? course.credit_points ?? CREDITS_PER_COURSE
    totalPoints += gradePoint * creditPoints
    totalCredits += creditPoints
  }

  return totalCredits > 0 ? totalPoints / totalCredits : 0
}

export const groupCoursesByGradeBand = (courses) => {
  const fail = []
  const pass = []
  const distinction = []

  for (const course of courses ?? []) {
    if (course.grade === 'F') {
      fail.push(course)
      continue
    }

    if (course.grade === 'P' || course.grade === 'C') {
      pass.push(course)
      continue
    }

    if (course.grade === 'D' || course.grade === 'HD') {
      distinction.push(course)
    }
  }

  return { fail, pass, distinction }
}

export const gradePointToMinScore = (gradePoint) => {
  const value = Number(gradePoint)

  if (!Number.isFinite(value) || value <= 1) {
    return 50
  }

  if (value <= 2) {
    return 60
  }

  if (value <= 3) {
    return 70
  }

  return 80
}

export const calculateRequiredRemainingAverage = (report, targetGradePoint) => {
  const credited = (report?.completed_courses ?? []).filter((course) => course.counts_toward_total)
  const earnedCreditPoints = report?.total_credit_points ?? 0
  const passedCourseCount = report?.passed_course_count ?? 0
  const remainingCourses = Math.max(0, REQUIRED_PASSING_COURSES - passedCourseCount)
  const remainingCreditPoints = remainingCourses * CREDITS_PER_COURSE
  const currentGpa = calculateGpa(report?.completed_courses ?? [])

  if (remainingCreditPoints <= 0) {
    return {
      achievable: true,
      alreadyMet: true,
      currentGpa,
      earnedCreditPoints,
      passedCourseCount,
      remainingCourses: 0,
      remainingCreditPoints: 0,
      requiredGradePoint: null,
      requiredMinScore: null,
    }
  }

  let currentWeightedPoints = 0

  for (const course of credited) {
    const gradePoint = gradePointForGrade(course.grade)

    if (gradePoint === null) {
      continue
    }

    currentWeightedPoints +=
      gradePoint * (course.earned_credit_points ?? course.credit_points ?? CREDITS_PER_COURSE)
  }

  const targetTotalPoints = targetGradePoint * DEGREE_CREDIT_POINTS
  const neededPoints = targetTotalPoints - currentWeightedPoints
  const requiredGradePoint = neededPoints / remainingCreditPoints

  return {
    achievable: requiredGradePoint <= 4,
    alreadyMet: false,
    currentGpa,
    earnedCreditPoints,
    passedCourseCount,
    remainingCourses,
    remainingCreditPoints,
    requiredGradePoint,
    requiredMinScore: gradePointToMinScore(requiredGradePoint),
  }
}
