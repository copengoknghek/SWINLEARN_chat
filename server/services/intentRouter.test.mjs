import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT,
  buildIntentRouterUserPrompt,
  normalizeIntentRoute,
  parseIntentRouteJson,
  routeIntent,
  routeIntentGroq,
} from './intentRouter.js'

const groqResponse = (payload) => async () => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
})

const geminiResponse = (payload) => async () => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(payload) }],
          },
        },
      ],
    }),
})

describe('intentRouter', () => {
  it('includes the three global intents in the system prompt', () => {
    assert.match(GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT, /grade_analysis/)
    assert.match(GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT, /document_qa/)
    assert.match(GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT, /smalltalk/)
  })

  it('parses structured JSON from Gemini text', () => {
    const parsed = parseIntentRouteJson(
      '{"intent":"grade_analysis","confidence":0.92,"extracted_data":{"agree":true,"target_grade":null,"keywords":null},"fallback_message":null}',
    )

    assert.deepEqual(parsed, {
      intent: 'grade_analysis',
      confidence: 0.92,
      extracted_data: {
        agree: true,
        target_grade: null,
        keywords: null,
      },
      fallback_message: null,
    })
  })

  it('normalizes invalid intent to document_qa fallback', () => {
    const normalized = normalizeIntentRoute({
      intent: 'not_a_real_intent',
      confidence: 0.3,
      extracted_data: {},
      fallback_message: 'Xin chào?',
    })

    assert.equal(normalized.intent, 'document_qa')
    assert.equal(normalized.confidence, 0.3)
    assert.equal(normalized.fallback_message, null)
  })

  it('drops fallback_message for smalltalk intent', () => {
    const normalized = normalizeIntentRoute({
      confidence: 0.9,
      extracted_data: { agree: null, keywords: null, target_grade: null },
      fallback_message: 'Xin lỗi, mình chưa hiểu rõ ý bạn.',
      intent: 'smalltalk',
    })

    assert.equal(normalized.intent, 'smalltalk')
    assert.equal(normalized.fallback_message, null)
  })

  it('keeps fallback_message for grade_analysis intent', () => {
    const normalized = normalizeIntentRoute({
      confidence: 0.3,
      extracted_data: { agree: null, keywords: null, target_grade: null },
      fallback_message: 'Bạn muốn chọn mức nào?',
      intent: 'grade_analysis',
    })

    assert.equal(normalized.fallback_message, 'Bạn muốn chọn mức nào?')
  })

  it('buildIntentRouterUserPrompt adds grade-analysis context hints', () => {
    const prompt = buildIntentRouterUserPrompt({
      contextHint: 'offered',
      message: 'yess please',
    })

    assert.match(prompt, /phân tích bản điểm/i)
    assert.match(prompt, /yess please/)
  })

  it('classifies grade export requests via Gemini', async () => {
    const route = await routeIntent({
      apiKey: 'test-key',
      fetchImpl: geminiResponse({
        confidence: 0.95,
        extracted_data: { agree: null, keywords: 'grades', target_grade: null },
        fallback_message: null,
        intent: 'grade_analysis',
      }),
      message: 'xem bản điểm của tôi',
    })

    assert.equal(route.intent, 'grade_analysis')
    assert.equal(route.confidence, 0.95)
  })

  it('classifies smalltalk via Gemini', async () => {
    const route = await routeIntent({
      apiKey: 'test-key',
      fetchImpl: geminiResponse({
        confidence: 0.88,
        extracted_data: { agree: null, keywords: null, target_grade: null },
        fallback_message: null,
        intent: 'smalltalk',
      }),
      message: 'hi bạn khỏe không',
    })

    assert.equal(route.intent, 'smalltalk')
  })

  it('returns fallback route when Gemini and Groq are both unavailable', async () => {
    const route = await routeIntent({
      apiKey: '',
      groqApiKey: '',
      message: 'hello',
    })

    assert.equal(route.intent, 'document_qa')
    assert.ok(route.fallback_message)
  })

  it('routes via Groq when Gemini is unavailable but Groq is configured', async () => {
    const route = await routeIntent({
      apiKey: '',
      fetchImpl: groqResponse({
        confidence: 0.9,
        extracted_data: { agree: null, keywords: null, target_grade: null },
        fallback_message: null,
        intent: 'grade_analysis',
      }),
      groqApiKey: 'test-groq-key',
      message: 'i want to see my grade table',
    })

    assert.equal(route.intent, 'grade_analysis')
  })
})

describe('routeIntentGroq', () => {
  it('classifies a grade request from natural language', async () => {
    const route = await routeIntentGroq({
      apiKey: 'test-groq-key',
      fetchImpl: groqResponse({
        confidence: 0.92,
        extracted_data: { agree: null, keywords: 'grades', target_grade: null },
        fallback_message: null,
        intent: 'grade_analysis',
      }),
      message: 'cho mình xem bảng điểm',
    })

    assert.equal(route.intent, 'grade_analysis')
    assert.equal(route.confidence, 0.92)
  })

  it('classifies smalltalk via Groq', async () => {
    const route = await routeIntentGroq({
      apiKey: 'test-groq-key',
      fetchImpl: groqResponse({
        confidence: 0.85,
        extracted_data: { agree: null, keywords: null, target_grade: null },
        fallback_message: null,
        intent: 'smalltalk',
      }),
      message: 'cảm ơn nhaa',
    })

    assert.equal(route.intent, 'smalltalk')
  })

  it('returns fallback route when Groq is unavailable', async () => {
    const route = await routeIntentGroq({ apiKey: '', message: 'hello' })

    assert.equal(route.intent, 'document_qa')
    assert.ok(route.fallback_message)
  })
})
