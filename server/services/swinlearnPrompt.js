const assignmentCompletionPatterns = [
  /\b(write|draft|finish|complete|do)\s+(my\s+)?(assignment|essay|report|homework|submission)\b/i,
  /\b(give|tell|show)\s+me\s+the\s+(final\s+)?answer\b/i,
  /\bsolve\s+(my\s+)?(homework|assignment|question|problem).*\b(completely|for me)?\b/i,
  /\bsubmit-ready\b/i,
]

const cvPortfolioPatterns = [
  /\b(cv|resume|curriculum vitae)\b/i,
  /\bportfolio\b/i,
  /\bproject bullets?\b/i,
  /\bmy submitted projects?\b/i,
  /\bcv-ready\b/i,
  /\bexport\b.*\b(cv|resume|projects?)\b/i,
  /\bmake\b[\s\S]{0,40}\b(cv|resume)\b/i,
  /\bhelp\s+(?:me\s+)?(?:put|add|get|build|make|write|create)\b[\s\S]{0,50}\b(cv|resume|portfolio)\b/i,
  /\b(i\s+)?(?:want|need)\b[\s\S]{0,40}\b(cv|resume|portfolio)\b/i,
  /\b(cv|resume|portfolio)\b[\s\S]{0,60}\b(for|from|about)\b/i,
  /\b(for|from)\b[\s\S]{0,60}\b(cv|resume|portfolio)\b/i,
]

const perfectCvPatterns = [
  /\bperfect\s+cv\b/i,
  /\bwhole\s+cv\b/i,
  /\bfull\s+cv\b/i,
  /\bcomplete\s+cv\b/i,
  /\bbuild\s+my\s+(perfect\s+)?cv\b/i,
]

const gradeExportPatterns = [
  /\bexport\b.*\b(grade|grades|marks?|scores?)\b/i,
  /\b(grade|grades)\b.*\b(table|report|export|download)\b/i,
  /\bmy\s+grades?\b/i,
  /\bdownload\s+grades?\b/i,
  /\bgrade\s+table\b/i,
  /\b(show|view|see)\b.*\b(grade|grades|marks?|scores?)\b/i,
  /\b(xem|hiển thị|hien thi)\b.*\b(bản điểm|ban diem|điểm|diem)\b/i,
  /\b(bản điểm|ban diem)\b.*\b(của tôi|cua toi|tôi|toi)\b/i,
]

export const cvProjectTemplate = `**PROJECT NAME**
Role: [Frontend|Backend|Full Stack|Data/ML|UI/UX|General] | Technologies: [comma-separated tools]
GitHub: [full URL from submission sources — omit this entire line when none]

• [Achievement bullet describing actual work evidenced in the submission]
• [Optional bullet — only when submission sources support it]`

export function isCvPortfolioRequest(message) {
  const text = String(message ?? '')

  if (isPerfectCvRequest(text)) {
    return true
  }

  return cvPortfolioPatterns.some((pattern) => pattern.test(text))
}

export function isPerfectCvRequest(message, intent = '') {
  if (String(intent ?? '') === 'perfect_cv') {
    return true
  }

  const text = String(message ?? '')

  return perfectCvPatterns.some((pattern) => pattern.test(text))
}

export function isGradeExportRequest(message, intent = '') {
  if (String(intent ?? '') === 'grade_export') {
    return true
  }

  const text = String(message ?? '')

  return gradeExportPatterns.some((pattern) => pattern.test(text))
}

export function isAssignmentCompletionRequest(message) {
  const text = String(message ?? '')

  if (isCvPortfolioRequest(text) || isGradeExportRequest(text)) {
    return false
  }

  return assignmentCompletionPatterns.some((pattern) => pattern.test(text))
}

export function buildSwinlearnInstructions({
  courseLabels = [],
  cvMode = false,
  perfectCvMode = false,
  scopedCourseCodes = [],
  scopeMode = 'pool',
  knowledgePoolEmpty = false,
} = {}) {
  const courses =
    courseLabels.length > 0
      ? courseLabels.map((label) => `- ${label}`).join('\n')
      : '- No courses selected for knowledge retrieval.'

  const scopedRules =
    scopedCourseCodes.length > 0
      ? [
          `The student is asking about: ${scopedCourseCodes.join(', ')}.`,
          'Answer only using sources whose course code or title matches those courses.',
          'If the sources do not contain assignments or content for that course, say so explicitly.',
        ]
      : knowledgePoolEmpty
        ? [
            'No courses are selected for knowledge retrieval.',
            'Answer general study questions without inventing course-specific modules, assignments, or readings.',
          ]
        : scopeMode === 'pool'
          ? [
              'The student may ask about any course in the selected knowledge pool.',
              'When answering about a specific course, use only sources for that course.',
            ]
          : []

  const cvRules = perfectCvMode
    ? [
        'The student wants a Perfect CV. Output only the ## Professional Experience section.',
        'Header, contact, education, skills, and certifications are in the perfect_cv_profile source — do not repeat or rewrite them.',
        'Use teacher assignment sources for project name and brief context only.',
        'Use student submission sources for all achievement bullets, technologies, tools, and outcomes.',
        'Never include an assignment that does not have a student submission source.',
        'Do not invent technologies, employers, dates, metrics, GitHub URLs, or outcomes.',
        'Role must describe project contribution (Frontend, Backend, Full Stack, Data/ML, UI/UX, or General) — never use Student as the role.',
        'Infer role from submission text, README, manifests, and inferred contribution hints in submission sources.',
        'Include a GitHub: line with the full URL when submission sources contain a GitHub project link; omit that line entirely when none is present.',
        'Write only about work, technologies, tools, and outcomes evidenced in submission sources.',
        'Never mention missing or absent features — omit unsupported bullets instead.',
        'Do not use placeholder brackets or filler text such as [functionality] or [metric/result].',
        'Preserve the project order listed in the perfect_cv_profile source.',
        'Format each project exactly with this Markdown template:',
        cvProjectTemplate,
      ]
    : cvMode
    ? [
        'The student wants CV help for specific submitted assignment project(s) only.',
        'Use teacher assignment sources for project name and brief context only.',
        'Use student submission sources for all achievement bullets, technologies, tools, and outcomes.',
        'Never include an assignment that does not have a student submission source.',
        'Do not invent technologies, employers, dates, metrics, GitHub URLs, or outcomes.',
        'Role must describe project contribution (Frontend, Backend, Full Stack, Data/ML, UI/UX, or General) — never use Student as the role.',
        'Infer role from submission text, README, manifests, and inferred contribution hints in submission sources.',
        'Include a GitHub: line with the full URL when submission sources contain a GitHub project link; omit that line entirely when none is present.',
        'Write only about work, technologies, tools, and outcomes evidenced in submission sources.',
        'Never mention missing or absent features (no API, no backend, no dataset, no metrics, etc.) — omit unsupported bullets instead.',
        'Do not use placeholder brackets or filler text such as [functionality] or [metric/result].',
        'At the top, list Included projects and Skipped (not submitted) when relevant.',
        'Format each project exactly with this Markdown template:',
        cvProjectTemplate,
      ]
    : []

  return [
    'You are SWINLEARN, a Socratic AI study tutor inside a university learning workspace.',
    knowledgePoolEmpty
      ? 'No course knowledge pool is selected. Answer general study questions and do not invent course-specific content.'
      : 'Use only the student\'s enrolled course knowledge and uploaded study files provided through retrieval.',
    'Never reuse facts from earlier chat messages unless the current retrieved sources support them.',
    'If the answer is not supported by those sources, say what is missing and suggest where the student can look next.',
    'Do not invent modules, lecture topics, files, weeks, or readings when a course only has catalog metadata or no imported knowledge package.',
    'Do not attribute assignments, modules, or readings from one course to another course.',
    'Cite the course, module, item, file, or uploaded document whenever you use retrieved knowledge.',
    ...(cvMode || perfectCvMode
      ? cvRules
      : [
          'Do not complete assignments for the student. Do not produce submit-ready essays, reports, code, final answers, or full solutions.',
          'For assignment-like requests, give Socratic coaching: clarify the concept, ask guiding questions, explain rubric language, give a small analogous example on different material, and suggest next steps.',
        ]),
    'Reply in the same language as the student when practical. Keep answers concise and study-focused.',
    ...scopedRules,
    '',
    'Allowed enrolled course context:',
    courses,
  ].join('\n')
}

export function assignmentCoachingMessage(message) {
  return [
    'I can help you learn how to approach this, but I cannot produce a submit-ready assignment answer.',
    '',
    'Let\'s work through it Socratically:',
    '1. What concept or lecture topic does the question connect to?',
    '2. What evidence from your course materials supports your first idea?',
    '3. Which part of your draft feels weakest right now?',
    '',
    `Your request: "${String(message ?? '').trim()}"`,
    '',
    'Send the part you understand so far, and I can give hints, explain the relevant knowledge, or help you check your reasoning.',
  ].join('\n')
}
