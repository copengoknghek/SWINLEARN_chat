import {
  calculateGpa,
  calculateRequiredRemainingAverage,
  DEGREE_CREDIT_POINTS,
  REQUIRED_PASSING_COURSES,
} from '../../src/features/swinlearn/lib/gradeProgressMetrics.mjs'

export const GRADUATION_GOALS = {
  average: {
    grade: 'P',
    gradePoint: 1,
    labelEn: 'Pass (average)',
    labelVi: 'Trung binh (P)',
  },
  good: {
    grade: 'C',
    gradePoint: 2,
    labelEn: 'Credit (good)',
    labelVi: 'Kha (C)',
  },
  excellent: {
    grade: 'D',
    gradePoint: 3,
    labelEn: 'Distinction (excellent)',
    labelVi: 'Gioi (D)',
  },
  outstanding: {
    grade: 'HD',
    gradePoint: 4,
    labelEn: 'High Distinction (outstanding)',
    labelVi: 'Xuat sac (HD)',
  },
}

const GOAL_SCORE_BANDS = {
  average: '50-59',
  good: '60-69',
  excellent: '70-79',
  outstanding: '80-100',
}

export const detectLanguage = (message) => {
  const text = String(message ?? '')

  if (
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      text,
    )
  ) {
    return 'vi'
  }

  if (
    /\b(có|không|muốn|bản điểm|tốt nghiệp|trung bình|khá|giỏi|xuất sắc|vâng|thôi)\b/i.test(
      text,
    )
  ) {
    return 'vi'
  }

  return 'en'
}

// Once the analysis reaches a terminal state (complete or declined), the flow
// is over. Gibberish after that should not re-trigger the flow, so the scanner
// stops as soon as it sees a terminal state instead of looping back to an
// earlier awaiting_goal message.
const GRADE_ANALYSIS_TERMINAL_STATES = new Set(['complete', 'declined'])

export const detectGradeAnalysisThreadContext = (history = []) => {
  const recent = history.slice(-8)

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const entry = recent[index]
    const role = entry.role ?? entry.metadata?.role

    if (role !== 'assistant' && role !== 'ASSISTANT') {
      continue
    }

    const analysisState = entry.metadata?.analysisState

    if (GRADE_ANALYSIS_TERMINAL_STATES.has(analysisState)) {
      return null
    }

    if (entry.metadata?.contentType === 'grade_export' && analysisState === 'offered') {
      return { state: 'offered' }
    }

    if (analysisState === 'awaiting_goal') {
      return { state: 'awaiting_goal' }
    }
  }

  return null
}

const formatCourseList = (courses, locale) => {
  if (courses.length === 0) {
    return locale === 'vi' ? '- Khong co' : '- None'
  }

  return courses.map((course) => `- ${course.code}: ${course.final_score} (${course.grade})`).join('\n')
}

export const formatGradeAnalysisOffer = (locale = 'en') =>
  locale === 'vi'
    ? 'Ban co muon phan tich ban diem cua minh khong?'
    : 'Would you like me to analyze your grade report?'

export const formatGradeAnalysisDecline = (locale = 'en') =>
  locale === 'vi'
    ? 'Khong sao. Neu ban con thac mac gi thi cu hoi.'
    : 'No problem. If you have any other questions, feel free to ask.'

export const formatUnknownUnderstanding = (locale = 'en') =>
  locale === 'vi'
    ? 'Xin lỗi, mình chưa hiểu ý bạn lắm. Bạn có thể hỏi mình về bài học, tài liệu môn học, hoặc bảng điểm nhé.'
    : "Sorry, I didn't quite catch that. You can ask me about lessons, course materials, or your grade report."

export const formatGradeAnalysisClarify = (locale = 'en') =>
  locale === 'vi'
    ? 'Xin lỗi, mình chưa rõ ý bạn. Bạn có muốn phân tích bản điểm này không? (Trả lời "có" hoặc "không" nha)'
    : "Sorry, I didn't quite catch that. Would you like me to analyze this grade report? (Reply \"yes\" or \"no\")"

const SOCIAL_SMALLTALK_RE = /\b(xin chào|chào|hello|hi|hey|halo|cảm ơn|thank you|thanks|tạm biệt|bye|goodbye|ok|ok nha|được|vâng|uh|uh huh|who are you|bạn là ai)\b/i
const VOWEL_RE = /[aeiouyàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
const PLAYFUL_NOISE_RE = /^(hehe|haha|hihi|huhu|lolo|lol|lmao|rofl|kek|meh|hm|hmm|mm|uhh|um|err|hmph|huh)+$/i

// Detects input that carries no understandable intent: a single character,
// random consonant clusters, or playful noise. Used so the bot replies with a
// clarification instead of greeting or silently repeating a stale prompt.
export const isGibberish = (message = '') => {
  const text = String(message).trim()

  if (!text) {
    return true
  }

  if (text.length < 2) {
    return true
  }

  if (SOCIAL_SMALLTALK_RE.test(text)) {
    return false
  }

  const letters = text.replace(/[^a-zà-ỹ]/gi, '')
  const hasVowel = VOWEL_RE.test(letters)

  if (letters && !hasVowel) {
    return true
  }

  if (/(.)\1{3,}/i.test(text)) {
    return true
  }

  // Four or more consecutive consonants is almost never a real word in the
  // supported languages and strongly signals random typing.
  if (/[b-df-hj-np-tv-xz]{4,}/i.test(letters)) {
    return true
  }

  if (PLAYFUL_NOISE_RE.test(text.replace(/\s+/g, ''))) {
    return true
  }

  return false
}

export const formatGradeGoalQuestion = (locale = 'en') =>
  locale === 'vi'
    ? [
        'Ban mong muon tot nghiep voi muc tieu nao?',
        '1. Trung binh (P: 50-59)',
        '2. Kha (C: 60-69)',
        '3. Gioi (D: 70-79)',
        '4. Xuat sac (HD: 80-100)',
      ].join('\n')
    : [
        'What graduation goal would you like to aim for?',
        '1. Pass / average (P: 50-59)',
        '2. Credit / good (C: 60-69)',
        '3. Distinction / excellent (D: 70-79)',
        '4. High Distinction / outstanding (HD: 80-100)',
      ].join('\n')

export const formatGradeAnalysisResult = (report, goalKey, locale = 'en') => {
  const goal = GRADUATION_GOALS[goalKey]
  const requirement = calculateRequiredRemainingAverage(report, goal.gradePoint)
  const gpa = calculateGpa(report?.completed_courses ?? [])
  const failCourses = (report?.completed_courses ?? []).filter((course) => course.grade === 'F')
  const scoreBand = GOAL_SCORE_BANDS[goalKey]

  if (locale === 'vi') {
    const lines = [
      '## Phan tich ban diem',
      '',
      '### Tien do hien tai',
      `- Credit points: ${requirement.earnedCreditPoints} / ${DEGREE_CREDIT_POINTS}`,
      `- Mon da pass: ${requirement.passedCourseCount} / ${REQUIRED_PASSING_COURSES}`,
      `- GPA hien tai (thang 4): ${gpa.toFixed(2)} / 4.0`,
      `- Muc tieu tot nghiep: ${goal.labelVi} (GPA muc tieu ${goal.gradePoint.toFixed(1)})`,
    ]

    if (failCourses.length > 0) {
      lines.push(
        '',
        'Cac mon F khong tinh credit va can hoc lai:',
        formatCourseList(failCourses, 'vi'),
      )
    }

    if (requirement.alreadyMet) {
      lines.push('', 'Ban da dat du so mon pass cho chuong trinh. Hay duy tri hoac nang cao diem neu can.')
      return lines.join('\n')
    }

    if (!requirement.achievable) {
      lines.push(
        '',
        '### Ket qua phan tich',
        `Muc tieu ${goal.labelVi} khong kha thi voi tien do hien tai.`,
        `Ban con ${requirement.remainingCourses} mon (${requirement.remainingCreditPoints} credit points).`,
        'Hay chon muc tieu thap hon hoac cai thien diem cac mon sap hoc.',
      )
      return lines.join('\n')
    }

    lines.push(
      '',
      '### Con lai',
      `- ${requirement.remainingCourses} mon (${requirement.remainingCreditPoints} credit points)`,
      '',
      '### Huong dan',
      `De dat muc tieu ${goal.labelVi}, cac mon con lai can dat trung binh it nhat **${requirement.requiredMinScore} diem** moi mon.`,
      `Muc tieu ${goal.grade} tuong ung khoang diem ${scoreBand}.`,
      `GPA tong the can huong toi ${goal.gradePoint.toFixed(1)} / 4.0 (F=0, P=1, C=2, D=3, HD=4).`,
      'Theo doi ban diem dinh ky de dieu chinh ke hoach hoc tap.',
    )

    return lines.join('\n')
  }

  const lines = [
    '## Grade analysis',
    '',
    '### Current progress',
    `- Credit points: ${requirement.earnedCreditPoints} / ${DEGREE_CREDIT_POINTS}`,
    `- Passed courses: ${requirement.passedCourseCount} / ${REQUIRED_PASSING_COURSES}`,
    `- Current GPA (4.0 scale): ${gpa.toFixed(2)} / 4.0`,
    `- Graduation goal: ${goal.labelEn} (target GPA ${goal.gradePoint.toFixed(1)})`,
  ]

  if (failCourses.length > 0) {
    lines.push('', 'Failed courses do not earn credit and may need to be retaken:', formatCourseList(failCourses, 'en'))
  }

  if (requirement.alreadyMet) {
    lines.push('', 'You already meet the passing course count for your program.')
    return lines.join('\n')
  }

  if (!requirement.achievable) {
    lines.push(
      '',
      '### Analysis result',
      `The ${goal.labelEn} goal is not achievable from your current progress.`,
      `You still need ${requirement.remainingCourses} courses (${requirement.remainingCreditPoints} credit points).`,
      'Choose a lower goal or aim higher on upcoming courses.',
    )
    return lines.join('\n')
  }

  lines.push(
    '',
    '### Remaining',
    `- ${requirement.remainingCourses} courses (${requirement.remainingCreditPoints} credit points)`,
    '',
    '### Guidance',
    `To reach ${goal.labelEn}, aim for at least **${requirement.requiredMinScore} points** on average in each remaining course.`,
    `A ${goal.grade} grade corresponds to the ${scoreBand} score band.`,
    `Your overall GPA should move toward ${goal.gradePoint.toFixed(1)} / 4.0 (F=0, P=1, C=2, D=3, HD=4).`,
    'Review your transcript regularly and adjust your study plan to stay on track.',
  )

  return lines.join('\n')
}
