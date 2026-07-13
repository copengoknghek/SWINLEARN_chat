import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { gradeFromScore, gradeLabel, isPassingScore, readFinalScore } from './courseGrades.js'

describe('courseGrades', () => {
  it('maps score boundaries to grades', () => {
    assert.equal(gradeFromScore(49), 'F')
    assert.equal(gradeFromScore(50), 'P')
    assert.equal(gradeFromScore(59), 'P')
    assert.equal(gradeFromScore(60), 'C')
    assert.equal(gradeFromScore(69), 'C')
    assert.equal(gradeFromScore(70), 'D')
    assert.equal(gradeFromScore(79), 'D')
    assert.equal(gradeFromScore(80), 'HD')
    assert.equal(gradeFromScore(100), 'HD')
  })

  it('returns readable grade labels', () => {
    assert.equal(gradeLabel('HD'), 'High Distinction')
    assert.equal(gradeLabel('F'), 'Fail')
  })

  it('treats 50 as passing', () => {
    assert.equal(isPassingScore(49), false)
    assert.equal(isPassingScore(50), true)
    assert.equal(isPassingScore(100), true)
  })

  it('validates final score input', () => {
    assert.equal(readFinalScore({ final_score: 72 }), 72)
    assert.equal(readFinalScore({ finalScore: 0 }), 0)
    assert.equal(readFinalScore({}), null)
    assert.equal(readFinalScore({ final_score: 72.5 }), undefined)
    assert.equal(readFinalScore({ final_score: -1 }), undefined)
    assert.equal(readFinalScore({ final_score: 101 }), undefined)
  })
})
