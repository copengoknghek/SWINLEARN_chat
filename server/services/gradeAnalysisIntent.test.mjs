import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  classifyGradeAnalysisIntent,
  parseGradeAnalysisIntentJson,
  targetGradeToGoalKey,
} from './gradeAnalysisIntent.js'

const groqResponse = (payload) => async () => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(payload),
          },
        },
      ],
    }),
})

describe('gradeAnalysisIntent', () => {
  it('parses structured JSON from Groq text', () => {
    const parsed = parseGradeAnalysisIntentJson(
      '{"agree": true, "target_grade": null, "fallback_message": null}',
    )

    assert.deepEqual(parsed, {
      agree: true,
      target_grade: null,
      fallback_message: null,
    })
  })

  it('parses JSON wrapped in markdown fences', () => {
    const parsed = parseGradeAnalysisIntentJson(
      '```json\n{"agree": false, "target_grade": null, "fallback_message": null}\n```',
    )

    assert.equal(parsed.agree, false)
  })

  it('maps target grade numbers to goal keys', () => {
    assert.equal(targetGradeToGoalKey(3), 'excellent')
    assert.equal(targetGradeToGoalKey(4), 'outstanding')
  })

  it('classifies agree intent from natural language via Groq', async () => {
    const result = await classifyGradeAnalysisIntent({
      apiKey: 'test-key',
      context: 'offered',
      fetchImpl: groqResponse({
        agree: true,
        fallback_message: null,
        target_grade: null,
      }),
      message: 'yess please',
    })

    assert.equal(result.agree, true)
    assert.equal(result.fallback_message, null)
  })

  it('classifies graduation goal from natural language via Groq', async () => {
    const result = await classifyGradeAnalysisIntent({
      apiKey: 'test-key',
      context: 'awaiting_goal',
      fetchImpl: groqResponse({
        agree: null,
        fallback_message: null,
        target_grade: 3,
      }),
      message: 'mình muốn giỏi',
    })

    assert.equal(result.target_grade, 3)
    assert.equal(targetGradeToGoalKey(result.target_grade), 'excellent')
  })

  it('returns fallback message when Groq output is unclear', async () => {
    const result = await classifyGradeAnalysisIntent({
      apiKey: 'test-key',
      context: 'awaiting_goal',
      fetchImpl: groqResponse({
        agree: null,
        fallback_message: null,
        target_grade: null,
      }),
      message: 'hmm',
    })

    assert.ok(result.fallback_message)
    assert.match(result.fallback_message, /chưa hiểu/i)
  })

  it('returns admin message when Groq API key is missing', async () => {
    const result = await classifyGradeAnalysisIntent({
      apiKey: '',
      context: 'offered',
      message: 'yes',
    })

    assert.match(result.fallback_message, /Groq/i)
  })
})
