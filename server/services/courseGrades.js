export const GRADE_LABELS = {
  F: 'Fail',
  P: 'Pass',
  C: 'Credit',
  D: 'Distinction',
  HD: 'High Distinction',
}

export const gradeFromScore = (score) => {
  const value = Number(score)

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null
  }

  if (value < 50) {
    return 'F'
  }

  if (value < 60) {
    return 'P'
  }

  if (value < 70) {
    return 'C'
  }

  if (value < 80) {
    return 'D'
  }

  return 'HD'
}

export const gradeLabel = (grade) => GRADE_LABELS[grade] ?? grade

export const isPassingScore = (score) => Number(score) >= 50

export const readFinalScore = (input) => {
  const raw = input.final_score ?? input.finalScore

  if (raw === undefined || raw === null || raw === '') {
    return null
  }

  const score = Number(raw)

  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return undefined
  }

  return score
}
