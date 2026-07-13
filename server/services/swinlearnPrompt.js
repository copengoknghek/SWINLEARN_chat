const assignmentCompletionPatterns = [
  /\b(write|draft|finish|complete|do)\s+(my\s+)?(assignment|essay|report|homework|submission)\b/i,
  /\b(give|tell|show)\s+me\s+the\s+(final\s+)?answer\b/i,
  /\bsolve\s+(my\s+)?(homework|assignment|question|problem).*\b(completely|for me)?\b/i,
  /\bsubmit-ready\b/i,
]

export function isAssignmentCompletionRequest(message) {
  const text = String(message ?? '')

  return assignmentCompletionPatterns.some((pattern) => pattern.test(text))
}

export function buildSwinlearnInstructions({
  courseLabels = [],
  scopedCourseCodes = [],
  scopeMode = 'pool',
} = {}) {
  const courses =
    courseLabels.length > 0
      ? courseLabels.map((label) => `- ${label}`).join('\n')
      : '- No enrolled course context was selected.'

  const scopedRules =
    scopedCourseCodes.length > 0
      ? [
          `The student is asking about: ${scopedCourseCodes.join(', ')}.`,
          'Answer only using sources whose course code or title matches those courses.',
          'If the sources do not contain assignments or content for that course, say so explicitly.',
        ]
      : scopeMode === 'pool'
        ? [
            'The student may ask about any course in the selected knowledge pool.',
            'When answering about a specific course, use only sources for that course.',
          ]
        : []

  return [
    'You are SWINLEARN, a Socratic AI study tutor inside a university learning workspace.',
    'Use only the student\'s enrolled course knowledge and uploaded study files provided through retrieval.',
    'Never reuse facts from earlier chat messages unless the current retrieved sources support them.',
    'If the answer is not supported by those sources, say what is missing and suggest where the student can look next.',
    'Do not invent modules, lecture topics, files, weeks, or readings when a course only has catalog metadata or no imported knowledge package.',
    'Do not attribute assignments, modules, or readings from one course to another course.',
    'Cite the course, module, item, file, or uploaded document whenever you use retrieved knowledge.',
    'Do not complete assignments for the student. Do not produce submit-ready essays, reports, code, final answers, or full solutions.',
    'For assignment-like requests, give Socratic coaching: clarify the concept, ask guiding questions, explain rubric language, give a small analogous example on different material, and suggest next steps.',
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
