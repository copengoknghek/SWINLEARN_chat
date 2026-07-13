import { extractGroqAssistantText } from './swinlearnGroq.js'

const groqApiBase = 'https://api.groq.com/openai/v1'

export const defaultGroqIntentModel =
  process.env.SWINLEARN_GROQ_INTENT_MODEL || process.env.SWINLEARN_GROQ_MODEL || 'llama-3.1-8b-instant'

export const TARGET_GRADE_TO_GOAL = {
  1: 'average',
  2: 'good',
  3: 'excellent',
  4: 'outstanding',
}

export const buildGradeAnalysisIntentSystemPrompt = (locale = 'en') => {
  const vi = locale === 'vi'

  const langIntro = vi
    ? 'Bạn là một bộ phân loại ý định (Intent Classifier) siêu thông minh cho hệ thống phân tích học tập SwinLearn. Nhiệm vụ của bạn là đọc câu trả lời của sinh viên và phân loại nó thành một cấu trúc JSON chuẩn xác. Luôn phản hồi (fallback_message) bằng tiếng Việt.'
    : 'You are a super-smart intent classifier for the SwinLearn study system. Your job is to read the student\'s reply and classify it into a precise JSON structure. Always respond (fallback_message) in English.'

  const tasks = vi
    ? `Nhiệm vụ 1: Xác định đồng ý/từ chối (Cho câu hỏi Export/Tiếp tục)
- Nếu ý của user là đồng ý (Ví dụ: "yes", "yess please", "ok nha", "được ạ", "bật lên đi", "y", "uh"): gán "agree": true
- Nếu ý của user là từ chối (Ví dụ: "no", "không", "thôi", "n", "cancel"): gán "agree": false
- Nếu không rõ ràng hoặc gõ linh tinh: gán "agree": null

Nhiệm vụ 2: Xác định mục tiêu điểm số tốt nghiệp (Cho câu hỏi chọn mục tiêu)
Dựa vào thang điểm: Pass (P=1), Credit (C=2), Distinction (D=3), High Distinction (HD=4).
- Hãy phân tích câu trả lời của user để tìm ra mục tiêu của họ. User có thể gõ số (3, 4, 1), gõ chữ viết tắt (D, HD, C), hoặc gõ chữ đầy đủ ("giỏi", "xuất sắc", "mức ba", "distinction").
- Quy đổi và gán giá trị "target_grade" thành một trong các số: 1, 2, 3, 4 tương ứng. Nếu không nhận diện được, gán bằng null.

Nhiệm vụ 3: Tạo thông điệp Fallback thông minh
- Nếu bạn không thể hiểu được ý định của user (cả agree và target_grade đều null), hãy viết một câu hỏi lại (fallback_message) bằng tiếng Việt cực kỳ thân thiện và gợi ý cho họ cách gõ đúng (Ví dụ: "Xin lỗi, mình chưa hiểu ý bạn lắm. Bạn muốn chọn mức điểm nào nè? (Bạn có thể gõ 3 hoặc 'Giỏi' nha)").
- Nếu đã hiểu ý user, gán "fallback_message": null`
    : `Task 1: Detect agree/decline (for the Export/Continue question)
- If the user agrees (e.g. "yes", "yess please", "ok", "sure", "y", "uh huh"): set "agree": true
- If the user declines (e.g. "no", "nope", "cancel", "n"): set "agree": false
- If unclear or gibberish: set "agree": null

Task 2: Detect the graduation target grade (for the goal question)
Grading scale: Pass (P=1), Credit (C=2), Distinction (D=3), High Distinction (HD=4).
- Analyze the reply to find their target. They may type a number (3, 4, 1), an abbreviation (D, HD, C), or a full word ("excellent", "distinction", "average").
- Map "target_grade" to one of 1, 2, 3, 4. If not recognized, set null.

Task 3: Smart fallback message
- If you cannot understand the intent (both agree and target_grade are null), write a friendly English clarification that hints how to reply (e.g. "Sorry, I didn't quite catch that. Would you like to analyze this grade report? (Reply yes or no)").
- If you understood the intent, set "fallback_message": null`

  return `${langIntro}\n\n${tasks}\n\nBẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON (return ONLY this JSON, no extra text):
{
  "agree": boolean or null,
  "target_grade": number (1-4) or null,
  "fallback_message": string or null
}`
}

export const GRADE_ANALYSIS_INTENT_SYSTEM_PROMPT = buildGradeAnalysisIntentSystemPrompt('vi')

const CONTEXT_HINTS = {
  offered:
    'Ngữ cảnh hiện tại: bot vừa hỏi sinh viên có muốn phân tích bản điểm hay không. Chỉ cần phân tích trường agree; để target_grade là null.',
  awaiting_goal:
    'Ngữ cảnh hiện tại: bot đang chờ sinh viên chọn mục tiêu tốt nghiệp (1=Trung bình/P, 2=Khá/C, 3=Giỏi/D, 4=Xuất sắc/HD). Chỉ cần phân tích trường target_grade; để agree là null.',
}

export const buildGradeAnalysisIntentUserPrompt = ({ message, context }) =>
  [CONTEXT_HINTS[context] ?? '', `Câu trả lời của sinh viên:\n${String(message ?? '').trim()}`]
    .filter(Boolean)
    .join('\n\n')

export const targetGradeToGoalKey = (targetGrade) => TARGET_GRADE_TO_GOAL[targetGrade] ?? null

export const normalizeGradeAnalysisIntent = (raw) => {
  const agree = raw?.agree === true ? true : raw?.agree === false ? false : null

  const parsedTarget = Number(raw?.target_grade)
  const targetGrade = [1, 2, 3, 4].includes(parsedTarget) ? parsedTarget : null
  const fallbackMessage = raw?.fallback_message ? String(raw.fallback_message).trim() : null

  return {
    agree,
    target_grade: targetGrade,
    fallback_message: fallbackMessage || null,
  }
}

export const parseGradeAnalysisIntentJson = (text) => {
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
    return normalizeGradeAnalysisIntent(JSON.parse(jsonMatch[0]))
  } catch {
    return null
  }
}

const defaultIntentFallback = (context) =>
  context === 'offered'
    ? 'Xin lỗi, mình chưa hiểu ý bạn lắm. Bạn có muốn phân tích bản điểm không? (Trả lời "có" hoặc "không" nha)'
    : 'Xin lỗi, mình chưa hiểu ý bạn lắm. Bạn muốn chọn mức điểm nào nè? (Bạn có thể gõ 3 hoặc "Giỏi" nha)'

export async function classifyGradeAnalysisIntent({
  message,
  context,
  locale = 'en',
  apiKey = process.env.GROQ_API_KEY,
  model = defaultGroqIntentModel,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    return {
      agree: null,
      target_grade: null,
      fallback_message:
        locale === 'vi'
          ? 'Hệ thống chưa kết nối Groq để hiểu câu trả lời. Vui lòng liên hệ quản trị viên.'
          : 'The system is not connected to Groq to understand your reply. Please contact an administrator.',
    }
  }

  try {
    const response = await fetchImpl(`${groqApiBase}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          { content: buildGradeAnalysisIntentSystemPrompt(locale), role: 'system' },
          {
            content: buildGradeAnalysisIntentUserPrompt({ context, message }),
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
      throw new Error(data?.error?.message || data?.error || 'Groq intent classification failed.')
    }

    const contentText = extractGroqAssistantText(data)
    const parsed = parseGradeAnalysisIntentJson(contentText)

    if (!parsed) {
      return {
        agree: null,
        target_grade: null,
        fallback_message: defaultIntentFallback(context),
      }
    }

    if (!parsed.fallback_message && parsed.agree === null && parsed.target_grade === null) {
      return {
        ...parsed,
        fallback_message: defaultIntentFallback(context),
      }
    }

    return parsed
  } catch {
    return {
      agree: null,
      target_grade: null,
      fallback_message: defaultIntentFallback(context),
    }
  }
}
