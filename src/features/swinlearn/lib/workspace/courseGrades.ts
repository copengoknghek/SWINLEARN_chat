export const GRADE_LABELS = {
  F: 'Fail',
  P: 'Pass',
  C: 'Credit',
  D: 'Distinction',
  HD: 'High Distinction',
} as const

export type CourseGrade = keyof typeof GRADE_LABELS

export const gradeFromScore = (score: number): CourseGrade | null => {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return null
  }

  if (score < 50) {
    return 'F'
  }

  if (score < 60) {
    return 'P'
  }

  if (score < 70) {
    return 'C'
  }

  if (score < 80) {
    return 'D'
  }

  return 'HD'
}

export const gradeLabel = (grade: CourseGrade | null) => (grade ? GRADE_LABELS[grade] : '—')

export const isPassingScore = (score: number) => score >= 50
