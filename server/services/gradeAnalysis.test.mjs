import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  detectGradeAnalysisThreadContext,
  detectLanguage,
  formatGradeAnalysisClarify,
  formatGradeAnalysisResult,
  formatUnknownUnderstanding,
  isGibberish,
} from './gradeAnalysis.js'

const sampleReport = {
  total_credit_points: 37.5,
  passed_course_count: 3,
  completed_courses: [
    {
      code: 'COS10009',
      final_score: 57,
      grade: 'P',
      counts_toward_total: true,
      earned_credit_points: 12.5,
      credit_points: 12.5,
    },
    {
      code: 'COS10005',
      final_score: 75,
      grade: 'D',
      counts_toward_total: true,
      earned_credit_points: 12.5,
      credit_points: 12.5,
    },
    {
      code: 'COS10004',
      final_score: 50,
      grade: 'P',
      counts_toward_total: true,
      earned_credit_points: 12.5,
      credit_points: 12.5,
    },
  ],
}

describe('gradeAnalysis', () => {
  it('detects Vietnamese language', () => {
    assert.equal(detectLanguage('xem bản điểm của tôi'), 'vi')
    assert.equal(detectLanguage('show my grades'), 'en')
  })

  it('detects grade analysis thread states', () => {
    const history = [
      {
        role: 'assistant',
        metadata: { contentType: 'grade_export', analysisState: 'offered' },
      },
    ]

    assert.deepEqual(detectGradeAnalysisThreadContext(history), { state: 'offered' })
  })

  it('formats analysis with remaining score guidance', () => {
    const text = formatGradeAnalysisResult(sampleReport, 'excellent', 'en')

    assert.match(text, /37\.5 \/ 300/)
    assert.match(text, /3 \/ 24/)
    assert.match(text, /Current GPA/)
    assert.match(text, /target GPA 3\.0/)
    assert.match(text, /at least \*\*80 points\*\*/)
    assert.match(text, /70-79/)
  })

  it('localizes the clarify message to the user language', () => {
    assert.match(formatGradeAnalysisClarify('en'), /reply "yes" or "no"/i)
    assert.doesNotMatch(formatGradeAnalysisClarify('en'), /Xin lỗi/)
    assert.match(formatGradeAnalysisClarify('vi'), /Xin lỗi/)
  })

  it('stops at a terminal grade state so gibberish afterwards does not re-open the flow', () => {
    const history = [
      { role: 'assistant', metadata: { contentType: 'grade_export', analysisState: 'awaiting_goal' } },
      { role: 'user', metadata: { content: '3' } },
      { role: 'assistant', metadata: { contentType: 'grade_analysis', analysisState: 'complete' } },
      { role: 'user', metadata: { content: 'hehe' } },
    ]

    assert.equal(detectGradeAnalysisThreadContext(history), null)
  })

  it('re-enters awaiting_goal when no terminal state sits between it and the latest message', () => {
    const history = [
      { role: 'assistant', metadata: { contentType: 'grade_export', analysisState: 'awaiting_goal' } },
    ]

    assert.deepEqual(detectGradeAnalysisThreadContext(history), { state: 'awaiting_goal' })
  })

  it('treats a declined analysis as terminal too', () => {
    const history = [
      { role: 'assistant', metadata: { contentType: 'grade_analysis', analysisState: 'declined' } },
    ]

    assert.equal(detectGradeAnalysisThreadContext(history), null)
  })

  it('flags gibberish and keeps short greetings understandable', () => {
    assert.equal(isGibberish('h'), true)
    assert.equal(isGibberish('hehe'), true)
    assert.equal(isGibberish('ieuncfwde'), true)
    assert.equal(isGibberish('qwrtz'), true)
    assert.equal(isGibberish('hello'), false)
    assert.equal(isGibberish('xem điểm của tôi'), false)
    assert.equal(isGibberish('hi'), false)
    assert.equal(isGibberish('thanks'), false)
  })

  it('formats a did-not-understand reply per language', () => {
    assert.match(formatUnknownUnderstanding('en'), /didn't quite catch that/i)
    assert.match(formatUnknownUnderstanding('vi'), /chưa hiểu/i)
  })
})
