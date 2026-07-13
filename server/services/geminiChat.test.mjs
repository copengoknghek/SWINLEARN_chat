import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateGeminiChatReply } from './geminiChat.js'

const geminiResponse = (text) => async () => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    }),
})

describe('geminiChat', () => {
  it('returns assistant text from Gemini', async () => {
    const reply = await generateGeminiChatReply({
      apiKey: 'test-key',
      fetchImpl: geminiResponse('Chào bạn! Mình là SWINLEARN.'),
      message: 'hi',
    })

    assert.equal(reply, 'Chào bạn! Mình là SWINLEARN.')
  })

  it('returns fallback when Gemini is unavailable', async () => {
    const reply = await generateGeminiChatReply({
      apiKey: '',
      message: 'hello',
    })

    assert.match(reply, /SWINLEARN/i)
  })
})
