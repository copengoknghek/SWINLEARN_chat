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

export function isAssignmentListingQuestion(message) {
  return /\b(list|how many|what|name|show|tell me)\b[\s\S]{0,80}\b(assignments?|assessments?)\b/i.test(
    String(message ?? ''),
  )
}
