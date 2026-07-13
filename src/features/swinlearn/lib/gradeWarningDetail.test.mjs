import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildGradeWarningDetail } from './gradeWarningDetail.mjs'

describe('gradeWarningDetail', () => {
  it('groups courses by fail, pass, and distinction bands', () => {
    const detail = buildGradeWarningDetail({
      total_credit_points: 25,
      passed_course_count: 2,
      completed_courses: [
        { code: 'COS1', grade: 'F', counts_toward_total: false, earned_credit_points: 0 },
        { code: 'COS2', grade: 'P', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
        { code: 'COS3', grade: 'C', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
        { code: 'COS4', grade: 'D', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
        { code: 'COS5', grade: 'HD', counts_toward_total: true, earned_credit_points: 12.5, credit_points: 12.5 },
      ],
    })

    assert.equal(detail.total_courses_studied, 5)
    assert.equal(detail.fail_courses.length, 1)
    assert.equal(detail.pass_courses.length, 2)
    assert.equal(detail.distinction_courses.length, 2)
    assert.equal(detail.earned_credit_points, 25)
    assert.equal(detail.remaining_courses, 22)
    assert.equal(detail.gpa, 2.5)
  })
})
