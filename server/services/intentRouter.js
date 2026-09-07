const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta'

export const defaultGeminiIntentModel =
  process.env.SWINLEARN_GEMINI_INTENT_MODEL || 'gemini-2.0-flash'

export const GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT = `Bạn là bộ não điều hướng ý định (Intent Router) cho Chatbot SwinLearn. Nhiệm vụ của bạn là đọc hiểu ngôn ngữ tự nhiên của sinh viên (bất kể tiếng Anh, tiếng Việt, viết tắt, sai chính tả) và phân loại xem họ đang muốn thực hiện tính năng nào.

Hãy phân loại tin nhắn vào một trong các "intent" sau:
1. "grade_analysis": Khi user muốn phân tích điểm, xem tiến độ học tập, xuất bảng điểm, chọn mục tiêu tốt nghiệp (Ví dụ: "xem điểm của mình", "tính gpa", "mình chọn mức 3", "yess please" khi hệ thống hỏi có muốn export không).
2. "document_qa": Khi user hỏi về kiến thức môn học, tìm tài liệu, hỏi nội dung trong file PDF đã upload (Ví dụ: "hạn nộp bài chương 2 là khi nào?", "định nghĩa của biến trong bài 1", "giải thích đoạn văn này").
3. "smalltalk": Khi user chào hỏi, tạm biệt, cảm ơn hoặc nói chuyện phiếm (Ví dụ: "hi", "halo", "cảm ơn bạn", "bạn là ai", "hôm nay trời đẹp không").
4. "unknown": Khi user nhập nội dung vô nghĩa, ngẫu nhiên, gõ bừa, hoặc không phải câu tiếng Việt/Tiếng Anh có nghĩa (Ví dụ: "asdfgh", "ieuncfwde", "qwe rty", "12345", hoặc chỉ gõ một ký tự vô nghĩa không nằm trong ngữ cảnh). Lúc này đừng đoán ý, hãy để intent là "unknown".

Bóc tách thực thể (Entities):
- Nếu intent là "grade_analysis": Hãy cố gắng bóc tách xem user có đang nhập mục tiêu điểm không (quy đổi sang số 1, 2, 3, 4) hoặc có đang đồng ý/từ chối không (true/false).
- Nếu intent là "document_qa": Trích xuất từ khóa cốt lõi họ muốn tìm kiếm.

BẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON CHUẨN, KHÔNG DƯ THỪA CHỮ:
{
  "intent": "grade_analysis" | "document_qa" | "smalltalk" | "unknown",
  "confidence": number (từ 0 đến 1 - mức độ tự tin của AI),
  "extracted_data": {
    "agree": boolean hoặc null,
    "target_grade": number (1-4) hoặc null,
    "keywords": string hoặc null
  },
  "fallback_message": string hoặc null (Chỉ điền khi không hiểu user nói gì và confidence < 0.5)
}`

const CONTEXT_HINTS = {
  offered:
    'Ngữ cảnh hiện tại: bot vừa hỏi sinh viên có muốn phân tích bản điểm hay không. Phân loại intent là grade_analysis và chỉ bóc tách trường agree; để target_grade là null.',
  awaiting_goal:
    'Ngữ cảnh hiện tại: bot đang chờ sinh viên chọn mục tiêu tốt nghiệp (1=Trung bình/P, 2=Khá/C, 3=Giỏi/D, 4=Xuất sắc/HD). Phân loại intent là grade_analysis và chỉ bóc tách trường target_grade; để agree là null.',
}

const VALID_INTENTS = new Set(['grade_analysis', 'document_qa', 'smalltalk', 'unknown'])

export const buildIntentRouterUserPrompt = ({ message, contextHint } = {}) =>
  [CONTEXT_HINTS[contextHint] ?? '', `Tin nhắn của sinh viên:\n${String(message ?? '').trim()}`]
    .filter(Boolean)
    .join('\n\n')

export const normalizeIntentRoute = (raw) => {
  const intent = VALID_INTENTS.has(raw?.intent) ? raw.intent : 'document_qa'
  const confidence = Number.isFinite(Number(raw?.confidence))
    ? Math.min(1, Math.max(0, Number(raw.confidence)))
    : 0

  const agree =
    raw?.extracted_data?.agree === true ? true : raw?.extracted_data?.agree === false ? false : null

  const parsedTarget = Number(raw?.extracted_data?.target_grade)
  const targetGrade = [1, 2, 3, 4].includes(parsedTarget) ? parsedTarget : null
  const keywords = raw?.extracted_data?.keywords ? String(raw.extracted_data.keywords).trim() : null
  const fallbackMessage = raw?.fallback_message ? String(raw.fallback_message).trim() : null

  return {
    intent,
    confidence,
    extracted_data: {
      agree,
      target_grade: targetGrade,
      keywords: keywords || null,
    },
    fallback_message: intent === 'grade_analysis' ? fallbackMessage || null : null,
  }
}

export const parseIntentRouteJson = (text) => {
  const trimmed = String(text ?? '').trim()

  if (!trimmed) {
    return null
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const jsonMatch = candidate.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return null
  }

  try {
    return normalizeIntentRoute(JSON.parse(jsonMatch[0]))
  } catch {
    return null
  }
}

const defaultRouteFallback = () => ({
  intent: 'document_qa',
  confidence: 0,
  extracted_data: {
    agree: null,
    target_grade: null,
    keywords: null,
  },
  fallback_message:
    'Xin lỗi, mình chưa hiểu rõ ý bạn. Bạn có thể hỏi về bài học, điểm số, hoặc chào hỏi nhé.',
})

export async function routeIntent({
  message,
  contextHint,
  apiKey = process.env.GEMINI_API_KEY,
  model = defaultGeminiIntentModel,
  fetchImpl = fetch,
  groqApiKey = process.env.GROQ_API_KEY,
  groqModel = process.env.SWINLEARN_GROQ_INTENT_MODEL || process.env.SWINLEARN_GROQ_MODEL || 'llama-3.1-8b-instant',
}) {
  if (!apiKey) {
    if (groqApiKey) {
      return routeIntentGroq({ contextHint, fetchImpl, apiKey: groqApiKey, message, model: groqModel })
    }

    return defaultRouteFallback()
  }

  try {
    const response = await fetchImpl(
      `${geminiApiBase}/models/${model}:generateContent`,
      {
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: buildIntentRouterUserPrompt({ message, contextHint }) }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              properties: {
                confidence: { type: 'NUMBER' },
                extracted_data: {
                  properties: {
                    agree: { nullable: true, type: 'BOOLEAN' },
                    keywords: { nullable: true, type: 'STRING' },
                    target_grade: { nullable: true, type: 'INTEGER' },
                  },
                  required: ['agree', 'target_grade', 'keywords'],
                  type: 'OBJECT',
                },
                fallback_message: { nullable: true, type: 'STRING' },
                intent: { enum: ['grade_analysis', 'document_qa', 'smalltalk'], type: 'STRING' },
              },
              required: ['intent', 'confidence', 'extracted_data', 'fallback_message'],
              type: 'OBJECT',
            },
            temperature: 0.1,
          },
          systemInstruction: {
            parts: [{ text: GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT }],
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
      throw new Error(data?.error?.message || data?.error || 'Gemini intent routing failed.')
    }

    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = parseIntentRouteJson(contentText)

    if (!parsed) {
      return defaultRouteFallback()
    }

    return parsed
  } catch {
    return defaultRouteFallback()
  }
}

const groqApiBase = 'https://api.groq.com/openai/v1'

// Groq-backed intent routing. Used when the Gemini key is absent but a Groq key
// is configured, so the chatbot still understands intent (grade_analysis,
// document_qa, smalltalk) from free-typed natural language instead of collapsing
// everything to document_qa. Reuses the same system prompt and JSON normalization.
export async function routeIntentGroq({
  message,
  contextHint,
  apiKey,
  model = process.env.SWINLEARN_GROQ_INTENT_MODEL || process.env.SWINLEARN_GROQ_MODEL || 'llama-3.1-8b-instant',
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) {
    return defaultRouteFallback()
  }

  try {
    const response = await fetchImpl(`${groqApiBase}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          { content: GLOBAL_INTENT_ROUTER_SYSTEM_PROMPT, role: 'system' },
          {
            content: buildIntentRouterUserPrompt({ contextHint, message }),
            role: 'user',
          },
        ],
        model,
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const rawText = await response.text()
    const data = rawText ? JSON.parse(rawText) : null

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.error || 'Groq intent routing failed.')
    }

    const contentText = data?.choices?.[0]?.message?.content
    const parsed = parseIntentRouteJson(contentText)

    if (!parsed) {
      return defaultRouteFallback()
    }

    return parsed
  } catch {
    return defaultRouteFallback()
  }
}
