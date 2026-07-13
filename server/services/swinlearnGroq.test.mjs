import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSwinlearnGroqPayload,
  defaultSwinlearnContextChars,
  extractGroqAssistantText,
} from './swinlearnGroq.js'

test('defaultSwinlearnContextChars stays under the Groq free tier token budget', () => {
  assert.ok(defaultSwinlearnContextChars <= 12000)
})

test('buildSwinlearnGroqPayload sends course documents through Groq chat completions', () => {
  const payload = buildSwinlearnGroqPayload({
    documents: [
      {
        courseCode: 'COS30049',
        id: 'course:offering-1',
        source: 'course',
        text: 'Week 1 explains that machine learning models learn patterns from data.',
        title: 'COS30049 - Machine Learning',
      },
    ],
    history: [
      { content: 'What is ML?', role: 'student' },
      { content: 'It is learning from data.', role: 'assistant' },
    ],
    instructions: 'Tutor rules',
    message: 'Where is this explained?',
    model: 'llama-3.1-8b-instant',
  })

  assert.equal(payload.model, 'llama-3.1-8b-instant')
  assert.equal(payload.stream, false)
  assert.deepEqual(payload.messages[0], { role: 'system', content: 'Tutor rules' })
  assert.deepEqual(payload.messages.slice(1, 3), [
    { role: 'user', content: 'What is ML?' },
    { role: 'assistant', content: 'It is learning from data.' },
  ])
  assert.equal(payload.messages.at(-1).role, 'user')
  assert.match(payload.messages.at(-1).content, /Where is this explained\?/)
  assert.match(payload.messages.at(-1).content, /COS30049 - Machine Learning/)
  assert.match(payload.messages.at(-1).content, /Course code: COS30049/)
  assert.match(payload.messages.at(-1).content, /Prior chat messages are context only/)
  assert.match(payload.messages.at(-1).content, /models learn patterns from data/)
  assert.equal(payload.tools, undefined)
})

test('buildSwinlearnGroqPayload adds images as Groq vision current-turn inputs', () => {
  const payload = buildSwinlearnGroqPayload({
    imageInputs: [
      {
        dataUrl: 'data:image/png;base64,abc123',
      },
    ],
    instructions: 'Tutor rules',
    message: 'Explain this diagram.',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  })

  assert.deepEqual(payload.messages.at(-1).content, [
    { type: 'text', text: 'Explain this diagram.' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
  ])
})

test('extractGroqAssistantText reads chat completion message content', () => {
  assert.equal(
    extractGroqAssistantText({
      choices: [
        {
          message: {
            content: 'Groq answer',
          },
        },
      ],
    }),
    'Groq answer',
  )
  assert.equal(extractGroqAssistantText({ choices: [] }), '')
})
