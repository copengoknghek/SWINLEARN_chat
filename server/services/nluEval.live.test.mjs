import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

// LIVE NLU EVALUATION SUITE
//
// Purpose: prove the chatbot understands the *meaning* of natural-language input
// (paraphrases, "yessss", typos, English/Vietnamese, polite forms) rather than
// matching fixed strings. This is the only layer that validates real LLM
// understanding.
//
// It is OPT-IN: it is skipped unless RUN_LIVE_NLU=1 AND the relevant API keys
// are present, so `npm test` stays offline, free, and deterministic.
//
// Run with:
//   RUN_LIVE_NLU=1 node --test server/services/nluEval.live.test.mjs
//
// LLMs are probabilistic. We assert the *semantic* outcome (intent class, agree
// boolean, target grade 1-4), not exact wording, and tolerate a small number of
// misses via MAX_MISSES so a single model hiccup does not fail the whole run.
// Read failures, do not blindly re-run.

const RUN_LIVE = process.env.RUN_LIVE_NLU === '1'
const hasGemini = Boolean(process.env.GEMINI_API_KEY)
const hasGroq = Boolean(process.env.GROQ_API_KEY)

const MAX_MISSES = Number(process.env.NLU_MAX_MISSES ?? 2)

const maybe = RUN_LIVE ? describe : describe.skip

const { routeIntent } = await import('./intentRouter.js')
const { classifyGradeAnalysisIntent, targetGradeToGoalKey } = await import('./gradeAnalysisIntent.js')

const tally = { misses: 0, total: 0 }

const expectSemantic = (label, actual, expected) => {
  tally.total += 1
  const ok = actual === expected
  if (!ok) {
    tally.misses += 1
    console.warn(`  NLU miss [${label}] expected=${expected} actual=${actual}`)
  }
  return ok
}

maybe('live intent routing understands natural language', () => {
  const cases = [
    // Paraphrased document_qa (not the literal "summary this course")
    { message: 'can you summary this course for me please', intent: 'document_qa' },
    { message: 'tóm tắt giúp mình môn này với', intent: 'document_qa' },
    { message: 'cho mình hỏi cái đề tài chương 2 là gì', intent: 'document_qa' },
    { message: 'where do i submit assignment 3', intent: 'document_qa' },
    // grade_analysis phrased many ways
    { message: 'cho mình xem điểm với', intent: 'grade_analysis' },
    { message: "whats my gpa looking like", intent: 'grade_analysis' },
    { message: 'mình muốn xuất bảng điểm', intent: 'grade_analysis' },
    { message: 'help me plan my graduation goal', intent: 'grade_analysis' },
    // smalltalk, including typos and casual Vietnamese
    { message: 'hey there', intent: 'smalltalk' },
    { message: 'cảm ơn nhaa', intent: 'smalltalk' },
    { message: 'ban la ai vay', intent: 'smalltalk' },
    { message: 'hôm nay trời đẹp quá', intent: 'smalltalk' },
  ]

  it('routes each paraphrase to the correct intent', async () => {
    for (const { message, intent } of cases) {
      const route = await routeIntent({ message })
      assert.ok(
        expectSemantic(`intent:${message}`, route.intent, intent),
        `message="${message}" -> expected ${intent}, got ${route.intent} (conf=${route.confidence})`,
      )
    }
    assert.ok(tally.misses <= MAX_MISSES, `Too many NLU misses: ${tally.misses}/${tally.total}`)
  })
})

maybe('live grade-analysis agree/disagree understands sloppy replies', () => {
  const cases = [
    { message: 'yessss', agree: true },
    { message: 'ok nha', agree: true },
    { message: 'uh được', agree: true },
    { message: 'y', agree: true },
    { message: 'sure thing', agree: true },
    { message: 'nope', agree: false },
    { message: 'thôi khỏi', agree: false },
    { message: 'n', agree: false },
    { message: 'maybe later', agree: false },
  ]

  it('classifies agree intent from messy replies', async () => {
    for (const { message, agree } of cases) {
      const result = await classifyGradeAnalysisIntent({ context: 'offered', message })
      assert.ok(
        expectSemantic(`agree:${message}`, result.agree, agree),
        `message="${message}" -> expected agree=${agree}, got ${result.agree}`,
      )
    }
    assert.ok(tally.misses <= MAX_MISSES, `Too many NLU misses: ${tally.misses}/${tally.total}`)
  })
})

maybe('live grade goal understands words, numbers and typos', () => {
  const cases = [
    { message: '3', target_grade: 3 },
    { message: 'giỏi', target_grade: 3 },
    { message: 'distinction', target_grade: 3 },
    { message: 'mức ba', target_grade: 3 },
    { message: 'HD', target_grade: 4 },
    { message: 'xuất sắc', target_grade: 4 },
    { message: 'C', target_grade: 2 },
    { message: 'just average is fine', target_grade: 1 },
  ]

  it('reads the graduation target from varied phrasing', async () => {
    for (const { message, target_grade } of cases) {
      const result = await classifyGradeAnalysisIntent({ context: 'awaiting_goal', message })
      assert.ok(
        expectSemantic(`target:${message}`, result.target_grade, target_grade),
        `message="${message}" -> expected target=${target_grade}, got ${result.target_grade}`,
      )
      if (result.target_grade) {
        assert.ok(targetGradeToGoalKey(result.target_grade), 'target maps to a known goal key')
      }
    }
    assert.ok(tally.misses <= MAX_MISSES, `Too many NLU misses: ${tally.misses}/${tally.total}`)
  })
})

if (!RUN_LIVE) {
  console.warn(
    'nluEval.live.test.mjs skipped (set RUN_LIVE_NLU=1 and configure GEMINI_API_KEY/GROQ_API_KEY to run the live evaluation).',
  )
} else if (!hasGemini || !hasGroq) {
  console.warn('nluEval.live.test.mjs: missing API key(s). GEMINI_API_KEY and GROQ_API_KEY are required.')
}
