const courseCodePattern = /\b([A-Z]{2,4}\d{4,5})\b/g

export function parseCourseCodesFromMessage(message, offerings = []) {
  const text = String(message ?? '').toUpperCase()
  const enrolledCodes = new Map(
    offerings.map((offering) => [String(offering.course.code).toUpperCase(), offering]),
  )
  const mentioned = new Set()

  for (const match of text.matchAll(courseCodePattern)) {
    const code = match[1]

    if (enrolledCodes.has(code)) {
      mentioned.add(code)
    }
  }

  return [...mentioned]
}

export function resolveMessageCourseScope({ message, offerings = [], poolOfferingIds = [] } = {}) {
  const pool = new Set(poolOfferingIds.map((id) => String(id)))
  const poolOfferings = offerings.filter((offering) => pool.has(String(offering.id)))
  const mentionedCodes = parseCourseCodesFromMessage(message, offerings)

  if (mentionedCodes.length === 0) {
    return {
      courseCodes: [],
      excludedFromPool: [],
      scopedOfferingIds: [...pool],
      scopeMode: 'pool',
    }
  }

  const mentionedOfferings = mentionedCodes
    .map((code) => offerings.find((offering) => String(offering.course.code).toUpperCase() === code))
    .filter(Boolean)
  const inPool = mentionedOfferings.filter((offering) => pool.has(String(offering.id)))
  const excludedFromPool = mentionedOfferings
    .filter((offering) => !pool.has(String(offering.id)))
    .map((offering) => offering.course.code)

  if (inPool.length > 0) {
    return {
      courseCodes: inPool.map((offering) => offering.course.code),
      excludedFromPool,
      scopedOfferingIds: inPool.map((offering) => offering.id),
      scopeMode: 'message',
    }
  }

  return {
    courseCodes: mentionedCodes,
    excludedFromPool,
    scopedOfferingIds: [],
    scopeMode: 'excluded',
  }
}

export function buildExcludedCourseMessage(codes = []) {
  const labels = codes.join(', ')

  return [
    `I can only use course knowledge you have added to this chat.`,
    '',
    `${labels} ${codes.length === 1 ? 'is' : 'are'} not in your selected courses.`,
    'Check the course in the Courses panel to add its knowledge to this chat, then ask again.',
  ].join('\n')
}

const submissionKeywordPattern = /\b(submit(?:ted|ed)?|turned in|submission)/i

const submittedAssignmentsReplyPattern =
  /(?:you(?:'ve| have) submitted|don'?t see any submitted assignments|Yes — so far you(?:'ve| have) only submitted|That'?s right)/i

const submissionFollowUpPattern =
  /\b(?:just\s+)?only\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(?:only|just|so)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i

export function isSubmittedAssignmentThreadReply(content = '') {
  return submittedAssignmentsReplyPattern.test(String(content ?? ''))
}

export function detectSubmittedAssignmentThreadContext(history = []) {
  const recent = history.slice(-8)

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const entry = recent[index]
    const role = entry.role ?? entry.metadata?.role

    if (role !== 'assistant' && role !== 'ASSISTANT') {
      continue
    }

    if (entry.metadata?.contentType === 'submitted_assignments') {
      return true
    }

    if (isSubmittedAssignmentThreadReply(entry.content)) {
      return true
    }

    return false
  }

  return false
}

export function extractCourseCodeFromSubmittedAssignmentHistory(history = []) {
  const courseInReplyPattern = /\bin ([A-Z]{2,4}\d{4,5})\b/i

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]

    if (entry.metadata?.contentType === 'submitted_assignments' && entry.metadata?.courseCode) {
      return String(entry.metadata.courseCode).toUpperCase()
    }

    const content = String(entry.content ?? '')
    const legacyMatch = content.match(
      /^(?:Submitted assignments in ([A-Z]{2,4}\d{4,5}):|You have not submitted any assignments in ([A-Z]{2,4}\d{4,5}) yet)/m,
    )

    if (legacyMatch) {
      return String(legacyMatch[1] ?? legacyMatch[2] ?? '').toUpperCase()
    }

    const naturalMatch = content.match(courseInReplyPattern)

    if (naturalMatch) {
      return String(naturalMatch[1]).toUpperCase()
    }
  }

  return ''
}

export function isSubmittedAssignmentFollowUp(message, history = []) {
  if (!detectSubmittedAssignmentThreadContext(history)) {
    return false
  }

  const text = String(message ?? '').trim()

  if (!text || text.length > 80) {
    return false
  }

  if (submissionFollowUpPattern.test(text)) {
    return true
  }

  return /^(?:really|are you sure|is that (?:right|correct|all)|that'?s (?:it|all)|correct)\??$/i.test(text)
}

export function isAssignmentListingQuestion(message) {
  const text = String(message ?? '')

  if (submissionKeywordPattern.test(text)) {
    return false
  }

  return /\b(list|how many|what|name|show|tell me)\b[\s\S]{0,80}\b(assignments?|assessments?)\b/i.test(
    text,
  )
}

export function isSubmittedAssignmentQuestion(message, history = []) {
  const text = String(message ?? '')

  if (/\b(cv|resume|portfolio)\b/i.test(text)) {
    return false
  }

  if (isSubmittedAssignmentFollowUp(text, history)) {
    return true
  }

  return (
    /\b(what|which|list|show|tell me|how many)\b[\s\S]{0,80}\b(submit(?:ted|ed)?|turned in|submission)/i.test(
      text,
    ) ||
    /\b(have i|did i|already)\b[\s\S]{0,60}\b(submit(?:ted|ed)?)/i.test(text) ||
    /\balready\s+submit/i.test(text) ||
    /\bhow many\b[\s\S]{0,80}\b(assignments?|assessments?|projects?)\b[\s\S]{0,80}\b(submit(?:ted|ed)?|turned in)/i.test(
      text,
    )
  )
}
