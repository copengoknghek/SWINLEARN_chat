import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  calculateGpa,
  calculateRequiredRemainingAverage,
  gradePointToMinScore,
} from './gradeProgressMetrics.mjs'

describe('gradeProgressMetrics', () => {
  it('calculates GPA from credited courses only', () => {
    const gpa = calculateGpa([
      { grade: 'F', counts_toward_total: false, earned_credit_points: 0, credit_points: 12.5 },
      { grade: 'P', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
      { grade: 'D', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
    ])

    assert.equal(gpa, 2)
  })

  it('maps required grade points to minimum score bands', () => {
    assert.equal(gradePointToMinScore(0.8), 50)
    assert.equal(gradePointToMinScore(1.2), 60)
    assert.equal(gradePointToMinScore(2.4), 70)
    assert.equal(gradePointToMinScore(3.2), 80)
  })

  it('calculates remaining course requirements for a graduation goal', () => {
    const requirement = calculateRequiredRemainingAverage(
      {
        total_credit_points: 37.5,
        passed_course_count: 3,
        completed_courses: [
          { grade: 'P', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
          { grade: 'D', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
          { grade: 'P', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
        ],
      },
      3,
    )

    assert.equal(requirement.remainingCourses, 21)
    assert.equal(requirement.achievable, true)
    assert.equal(requirement.requiredMinScore, 80)
  })
})
