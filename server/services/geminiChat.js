const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta'

export const defaultGeminiChatModel =
  process.env.SWINLEARN_GEMINI_CHAT_MODEL || process.env.SWINLEARN_GEMINI_INTENT_MODEL || 'gemini-2.0-flash'

const SMALLTALK_SYSTEM_PROMPT = `Bạn là SWINLEARN, trợ lý học tập thân thiện trong workspace đại học Swinburne.
Trả lời ngắn gọn, ấm áp, bằng cùng ngôn ngữ với sinh viên.
Nếu họ hỏi bạn là ai, giới thiệu bạn là trợ lý học tập SWINLEARN.
Không bịa điểm số hay nội dung môn học; gợi ý họ hỏi về tài liệu hoặc bảng điểm nếu cần.`

export async function generateGeminiChatReply({
  message,
  history = [],
  apiKey = process.env.GEMINI_API_KEY,
  model = defaultGeminiChatModel,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    return 'Xin chào! Mình là SWINLEARN — trợ lý học tập của bạn. Hãy hỏi mình về bài học hoặc điểm số nhé.'
  }

  const recentHistory = history
    .slice(-6)
    .map((entry) => ({
      role: entry.role === 'assistant' || entry.role === 'ASSISTANT' ? 'model' : 'user',
      parts: [{ text: String(entry.content ?? '').trim() }],
    }))
    .filter((entry) => entry.parts[0].text)

  try {
    const response = await fetchImpl(
      `${geminiApiBase}/models/${model}:generateContent`,
      {
        body: JSON.stringify({
          contents: [
            ...recentHistory,
            {
              role: 'user',
              parts: [{ text: String(message ?? '').trim() }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
          },
          systemInstruction: {
            parts: [{ text: SMALLTALK_SYSTEM_PROMPT }],
          },
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        method: 'POST',
      },
    )

    const rawText = await response.text()
    const data = rawText ? JSON.parse(rawText) : null

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.error || 'Gemini chat failed.')
    }

    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text

    return contentText?.trim() || 'Xin chào! Mình có thể giúp gì cho bạn hôm nay?'
  } catch {
    return 'Xin chào! Mình là SWINLEARN. Hãy hỏi mình về bài học hoặc điểm số nhé.'
  }
}
