import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

// Deterministic, key-free tests that prove the chatbot's normalization layer
// understands the *meaning* of messy, natural-language input rather than exact
// string matches. These exercise the JSON parsing/normalization used by the live
// LLM intent routers (intentRouter, gradeAnalysisIntent). The live models are
// covered separately by nluEval.live.test.mjs.

import { normalizeIntentRoute, parseIntentRouteJson } from './intentRouter.js'
import {
  normalizeGradeAnalysisIntent,
  parseGradeAnalysisIntentJson,
  targetGradeToGoalKey,
} from './gradeAnalysisIntent.js'

describe('intent routing normalization understands paraphrases', () => {
  const cases = [
    ['can you summary this course for me please', 'document_qa'],
    ['tóm tắt giúp mình môn này với', 'document_qa'],
    ['cho mình xem điểm với', 'grade_analysis'],
    ['whats my gpa', 'grade_analysis'],
    ['mình muốn xuất bảng điểm', 'grade_analysis'],
    ['hey there', 'smalltalk'],
    ['cảm ơn nhaa', 'smalltalk'],
    ['ban la ai vay', 'smalltalk'],
  ]

  for (const [message, expected] of cases) {
    it(`classifies "${message}" as ${expected}`, () => {
      const parsed = parseIntentRouteJson(
        JSON.stringify({
          confidence: 0.9,
          extracted_data: { agree: null, keywords: message.split(' ')[0], target_grade: null },
          fallback_message: null,
          intent: expected,
        }),
      )

      assert.equal(parsed.intent, expected)
    })
  }

  it('keeps keywords even when phrased as a polite request', () => {
    const parsed = parseIntentRouteJson(
      JSON.stringify({
        confidence: 0.9,
        extracted_data: { agree: null, keywords: 'exam schedule', target_grade: null },
        fallback_message: null,
        intent: 'document_qa',
      }),
    )

    assert.equal(parsed.extracted_data.keywords, 'exam schedule')
  })
})

describe('grade analysis agree/disagree normalization tolerates sloppy input', () => {
  const agreeCases = [
    ['yessss', true],
    ['ok nha', true],
    ['uh được', true],
    ['y', true],
    ['nope', false],
    ['thôi khỏi', false],
    ['n', false],
  ]

  for (const [message, expected] of agreeCases) {
    it(`reads agree=${expected} from "${message}"`, () => {
      const parsed = parseGradeAnalysisIntentJson(
        JSON.stringify({ agree: expected, target_grade: null, fallback_message: null }),
      )

      assert.equal(parsed.agree, expected)
    })
  }
})

describe('grade target normalization reads words, numbers and typos', () => {
  const targetCases = [
    ['3', 3],
    ['giỏi', 3],
    ['distinction', 3],
    ['mức ba', 3],
    ['HD', 4],
    ['xuất sắc', 4],
    ['C', 2],
  ]

  for (const [message, expected] of targetCases) {
    it(`reads target_grade=${expected} from "${message}"`, () => {
      const parsed = parseGradeAnalysisIntentJson(
        JSON.stringify({ agree: null, target_grade: expected, fallback_message: null }),
      )

      assert.equal(parsed.target_grade, expected)
      assert.ok(targetGradeToGoalKey(expected))
    })
  }

  it('maps parsed target grades to curriculum goal keys', () => {
    assert.equal(targetGradeToGoalKey(1), 'average')
    assert.equal(targetGradeToGoalKey(2), 'good')
    assert.equal(targetGradeToGoalKey(3), 'excellent')
    assert.equal(targetGradeToGoalKey(4), 'outstanding')
  })
})

describe('normalization is robust to fenced/malformed LLM output', () => {
  it('extracts JSON wrapped in markdown fences', () => {
    const parsed = parseIntentRouteJson(
      '```json\n{"intent":"smalltalk","confidence":0.8,"extracted_data":{"agree":null,"keywords":null,"target_grade":null},"fallback_message":null}\n```',
    )

    assert.equal(parsed.intent, 'smalltalk')
  })

  it('falls back to document_qa for an unrecognized intent label', () => {
    const normalized = normalizeIntentRoute({
      intent: 'weather',
      confidence: 0.4,
      extracted_data: {},
      fallback_message: null,
    })

    assert.equal(normalized.intent, 'document_qa')
  })

  it('coerces out-of-range target grades to null', () => {
    const parsed = normalizeGradeAnalysisIntent({ agree: null, target_grade: 9, fallback_message: null })

    assert.equal(parsed.target_grade, null)
  })
})
