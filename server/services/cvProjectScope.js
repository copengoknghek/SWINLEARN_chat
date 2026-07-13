import path from 'node:path'

import { htmlToPlainText } from './courseContentImport.js'
import {
  isAssignmentListingQuestion,
  isSubmittedAssignmentFollowUp,
  isSubmittedAssignmentQuestion,
  parseCourseCodesFromMessage,
} from './swinlearnCourseScope.js'
import { isCvPortfolioRequest } from './swinlearnPrompt.js'
import { buildSubmissionSegments } from './submissionIndexing.js'

const allAssignmentsPattern =
  /\b(?:all|every)\b[\s\S]{0,40}\b(?:assignments?|projects?|submissions?)\b/i

const quotedTitlePattern = /["“]([^"”]+)["”]/
const quotedPairPattern = /["“]([^"”]+)["”]\s+in\s+([A-Z]{2,4}\d{4,5})/gi
const inCourseTitlePattern = /\b(?:for|from|about)\s+(.+?)\s+in\s+([A-Z]{2,4}\d{4,5})\b/i
const courseCodePattern = /\b([A-Z]{2,4}\d{4,5})\b/g
const cvTrailingSuffixPattern = /\s+to\s+my\s+(?:cv|resume)\s*$/i
const cvTrailingFillerPattern = /\s+(?:for me|please|thanks|thank you)\s*$/i
const cvPreamblePattern =
  /^(?:(?:please\s+)?(?:(?:can|could)\s+you\s+)?)?(?:(?:build|make|create|draft|generate|write|prepare|get|give)\s+(?:a\s+)?(?:my\s+)?(?:perfect\s+)?(?:cv|resume|curriculum vitae)|(?:help\s+(?:me\s+)?(?:with|to)?\s+)?(?:add|include|put|insert)\s+(?:entries?\s+)?(?:to\s+)?(?:my\s+)?(?:cv|resume|portfolio))(?:\s*[,;:\-–—]|\s+)(?:(?:add|include|with|that)\s+)?/i

const leadingTitleNoisePatterns = [
  /^(?:(?:hi|hey|hello)\s+)/i,
  /^(?:(?:can|could)\s+you\s+)/i,
  /^(?:please\s+|kindly\s+)/i,
  /^(?:(?:i\s+)?(?:want|need|would like)(?:\s+to)?\s+)/i,
  /^(?:help\s+(?:me\s+)?(?:with|to|put|add|get|write|build|make)\s+)/i,
  /^(?:(?:generate|create|build|make|draft|write|prepare|get|give)\s+(?:me\s+)?)/i,
  /^(?:(?:a\s+)?(?:cv|resume|portfolio|curriculum vitae)\s+)/i,
  /^(?:(?:cv|resume|portfolio)\s+(?:entry|entries|bullets?|section)\s+)/i,
  /^(?:(?:entry|entries)\s+(?:for\s+)?)/i,
  /^(?:portfolio\s+)/i,
  /^(?:(?:for|from|about|with)\s+)/i,
  /^(?:(?:add|include|put|insert)\s+)/i,
  /^(?:that\s+)/i,
  /^(?:to\s+)/i,
  /^(?:by\s+)/i,
  /^(?:use\s+)/i,
  /^(?:,|;|and)\s+/i,
]

const trailingTitleNoisePatterns = [
  /\s+(?:for|in|on|to|into)\s*$/i,
  /\s+on\s+my\s+(?:cv|resume|portfolio)\s*$/i,
  /\s+(?:to|into)\s+my\s+(?:cv|resume|portfolio)\s*$/i,
  /\s+(?:for|to)\s+my\s+(?:cv|resume|portfolio)\s*$/i,
  /\s+(?:cv|resume|portfolio)(?:\s+please)?\s*$/i,
  cvTrailingFillerPattern,
]

const assignmentTailPatterns = [
  /\b(assignment\s+\d+[\w\s\-:/]*)\s*$/i,
  /\b(week\s+\d+[\w\s\-:/]*)\s*$/i,
  /\b(project\s*\([^)]+\))\s*$/i,
  /\b(project[\w\s\-:/]*)\s*$/i,
  /\b(Wk\d+:[\w\s\-:/]*)\s*$/i,
  /\b(lab[\w\s\-:/]*)\s*$/i,
]

const noisyTitlePattern =
  /^(?:help|can|could|please|entry|entries|generate|create|put|add|get|write|make|build|portfolio|cv|resume|that|with)\b|\b(?:cv|resume|portfolio)\s*$/i

const followUpLeadPatterns = [
  /^(?:oh\s+)?(?:i mean|i meant|sorry,?|actually|no,?)\s+/i,
  /^(?:the assignment (?:i want )?is|my mistake,?)\s+/i,
]

const numberedListLinePattern = /^\s*(\d+)\.\s+(.+)\s*$/

const ordinalWords = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

const frontendTech = ['vue', 'react', 'angular', 'svelte', 'bootstrap', 'tailwind', 'vite', 'webpack', 'css', 'html']
const backendTech = [
  'express',
  'fastapi',
  'django',
  'flask',
  'spring',
  'node',
  'prisma',
  'postgresql',
  'mongodb',
  'mysql',
  'api',
  'rest',
]
const dataTech = ['pandas', 'numpy', 'tensorflow', 'pytorch', 'sklearn', 'matplotlib', 'machine learning']

const cvScopeReplyPatterns = [
  /can'?t add it to your CV/i,
  /cannot be added to your CV/i,
  /assignments in that course/i,
  /Assignments in [A-Z]{2,4}\d{4,5}/,
  /which (?:assignment |one )?did you mean/i,
  /which one did you have in mind/i,
  /I found more than one assignment/i,
  /I cannot generate the CV until/i,
  /I couldn'?t find an assignment/i,
  /I could not find an assignment matching/i,
  /not sure which assignment you mean/i,
  /Please include a course code/i,
]

export function isCvTopicChange(message) {
  const text = String(message ?? '').trim()

  if (!text || isCvPortfolioRequest(text)) {
    return false
  }

  if (isSubmittedAssignmentQuestion(text)) {
    return true
  }

  if (/\?$/.test(text)) {
    return true
  }

  if (/^(what|how|why|when|where|explain|describe|can you|could you)\b/i.test(text)) {
    if (/^(i mean|i meant|sorry)/i.test(text)) {
      return false
    }

    return true
  }

  if (isAssignmentListingQuestion(text) && !/\b(cv|resume|portfolio)\b/i.test(text)) {
    return true
  }

  return false
}

export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const trailingTitleNoiseTokens = new Set([
  'course',
  'cos',
  'subject',
  'class',
  'unit',
  'please',
  'thanks',
  'thank',
  'you',
  'me',
])

const leadingTitleConjunctionTokens = new Set(['by', 'use', 'from', 'with', 'for', 'to', 'the'])

function dropTrailingNoiseTokens(tokens) {
  const trimmed = [...tokens]

  while (trimmed.length > 1 && trailingTitleNoiseTokens.has(trimmed[trimmed.length - 1])) {
    trimmed.pop()
  }

  return trimmed
}

function dropLeadingNoiseTokens(tokens) {
  const trimmed = [...tokens]

  while (trimmed.length > 1 && leadingTitleConjunctionTokens.has(trimmed[0])) {
    trimmed.shift()
  }

  return trimmed
}

export function detectCvThreadContext(history = []) {
  const recent = history.slice(-8)

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const entry = recent[index]
    const role = entry.role ?? entry.metadata?.role

    if (role === 'assistant' || role === 'ASSISTANT') {
      const contentType = entry.metadata?.contentType

      if (contentType === 'cv_export' || contentType === 'cv_scope') {
        return true
      }

      const content = String(entry.content ?? '')

      if (cvScopeReplyPatterns.some((pattern) => pattern.test(content))) {
        return true
      }
    }

    if ((role === 'student' || role === 'STUDENT') && isCvPortfolioRequest(entry.content)) {
      return true
    }
  }

  return false
}

export function extractCourseCodeFromCvHistory(history = [], offerings = []) {
  const enrolledCodes = new Set(
    offerings.map((offering) => String(offering.course?.code ?? offering.code ?? '').toUpperCase()).filter(Boolean),
  )

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]

    if (entry.metadata?.courseCode) {
      return String(entry.metadata.courseCode).toUpperCase()
    }

    const codes = parseCourseCodesFromMessage(entry.content, offerings)

    if (codes.length > 0) {
      return codes[0]
    }

    const content = String(entry.content ?? '').toUpperCase()

    for (const match of content.matchAll(courseCodePattern)) {
      const code = match[1]

      if (enrolledCodes.size === 0 || enrolledCodes.has(code)) {
        return code
      }
    }
  }

  return ''
}

export function parseOrdinalToken(token) {
  const normalized = String(token ?? '').toLowerCase().trim()

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10)
  }

  return ordinalWords[normalized] ?? 0
}

export function parseListReference(text) {
  const normalized = normalizeTitle(text)
    .replace(/^(?:oh\s+)?(?:i mean(?:t)?\s+)?/, '')
    .replace(/^the\s+/, '')
    .trim()

  if (!normalized) {
    return null
  }

  if (/^(first|1st)\s+assignment$/.test(normalized)) {
    return { type: 'ambiguous_first_assignment' }
  }

  const assignmentNumberMatch = normalized.match(/^assignment\s+(\d+|[a-z]+)$/)

  if (assignmentNumberMatch) {
    const number = parseOrdinalToken(assignmentNumberMatch[1])

    if (number > 0) {
      return { number, type: 'assignment_number' }
    }
  }

  const ordinalPatterns = [
    /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:\s+one)?$/,
    /^(\d+)(?:st|nd|rd|th)?(?:\s+one)?$/,
    /^(one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+one)?$/,
    /^number\s+(\d+|[a-z]+)$/,
  ]

  for (const pattern of ordinalPatterns) {
    const match = normalized.match(pattern)

    if (match?.[1]) {
      const position = parseOrdinalToken(match[1])

      if (position > 0) {
        return { position, type: 'ordinal' }
      }
    }
  }

  return null
}

export function extractAssignmentListFromHistory(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    const role = entry.role ?? entry.metadata?.role

    if (role !== 'assistant' && role !== 'ASSISTANT') {
      continue
    }

    const metadataList = entry.metadata?.assignmentList

    if (Array.isArray(metadataList) && metadataList.length > 0) {
      return metadataList.map((title) => String(title).trim()).filter(Boolean)
    }

    const content = String(entry.content ?? '')

    if (!cvScopeReplyPatterns.some((pattern) => pattern.test(content))) {
      continue
    }

    const titles = []

    for (const line of content.split('\n')) {
      const match = line.match(numberedListLinePattern)

      if (match) {
        titles.push(match[2].trim())
      }
    }

    if (titles.length > 0) {
      return titles
    }
  }

  return []
}

export function resolveCvScopeAssignmentList(cvTurn = {}) {
  const resolution = cvTurn.resolution ?? {}
  const followUp = cvTurn.followUp ?? {}

  if (Array.isArray(resolution.assignmentTitles) && resolution.assignmentTitles.length > 0) {
    return resolution.assignmentTitles
  }

  if (Array.isArray(followUp.candidates) && followUp.candidates.length > 0) {
    return followUp.candidates.map((candidate) =>
      typeof candidate === 'string' ? candidate : String(candidate.title ?? candidate).trim(),
    )
  }

  if (Array.isArray(resolution.candidates) && resolution.candidates.length > 0) {
    return resolution.candidates.map((candidate) =>
      typeof candidate === 'string' ? candidate : String(candidate.title ?? candidate).trim(),
    )
  }

  if (resolution.status === 'blocked' && Array.isArray(resolution.targetResults)) {
    const notFoundResults = resolution.targetResults.filter(
      (result) => result.status === 'not_found' && result.assignmentTitles?.length > 0,
    )

    if (notFoundResults.length === 1) {
      return notFoundResults[0].assignmentTitles
    }
  }

  return null
}

function findAssignmentByNumber(assignments = [], number) {
  const target = `assignment ${number}`
  const exactMatches = assignments.filter((title) => normalizeTitle(title) === target)

  if (exactMatches.length === 1) {
    return exactMatches
  }

  return assignments.filter((title) => {
    const normalized = normalizeTitle(title)

    return normalized === target || normalized.startsWith(`${target} `)
  })
}

export function resolveListReference(reference, assignmentTitles = []) {
  if (!reference || assignmentTitles.length === 0) {
    return null
  }

  if (reference.type === 'ordinal') {
    const index = reference.position - 1

    if (index >= 0 && index < assignmentTitles.length) {
      return { position: reference.position, resolved: assignmentTitles[index] }
    }

    return { outOfRange: true, position: reference.position }
  }

  if (reference.type === 'assignment_number') {
    const matches = findAssignmentByNumber(assignmentTitles, reference.number)

    if (matches.length === 1) {
      return { resolved: matches[0] }
    }

    if (matches.length > 1) {
      return {
        ambiguous: matches,
        query: `assignment ${reference.number}`,
      }
    }

    return null
  }

  if (reference.type === 'ambiguous_first_assignment') {
    const byPosition = assignmentTitles[0]
    const byName = findAssignmentByNumber(assignmentTitles, 1)[0]
    const ambiguous = []

    if (byPosition) {
      ambiguous.push(byPosition)
    }

    if (byName && byName !== byPosition) {
      ambiguous.push(byName)
    }

    if (ambiguous.length === 1) {
      return { resolved: ambiguous[0] }
    }

    if (ambiguous.length > 1) {
      return {
        ambiguous,
        query: 'the first assignment',
      }
    }

    return null
  }

  return null
}

function resolveFollowUpTitle(title, history = []) {
  const listReference = parseListReference(title)

  if (!listReference) {
    return { title }
  }

  const assignmentTitles = extractAssignmentListFromHistory(history)
  const resolution = resolveListReference(listReference, assignmentTitles)

  if (resolution?.resolved) {
    return {
      fromListPick: listReference.type === 'ordinal',
      title: resolution.resolved,
    }
  }

  if (resolution?.ambiguous) {
    return {
      ambiguous: resolution.ambiguous,
      query: resolution.query ?? title,
      status: 'list_reference_ambiguous',
    }
  }

  return { title }
}

export function cleanFollowUpTitle(rawTitle) {
  let title = String(rawTitle ?? '').trim().replace(/^["'“”]+|["'“”]+$/g, '')

  for (const pattern of followUpLeadPatterns) {
    title = title.replace(pattern, '').trim()
  }

  return title.replace(/^["'“”]+|["'“”]+$/g, '').trim()
}

function cleanNaturalSegmentTitle(rawTitle) {
  return extractTitleFromChunk(rawTitle)
}

function stripIteratively(text, patterns) {
  let value = String(text ?? '').trim()
  let changed = true

  while (changed) {
    changed = false

    for (const pattern of patterns) {
      const next = value.replace(pattern, '').trim()

      if (next !== value) {
        value = next
        changed = true
        break
      }
    }
  }

  return value
}

function refineExtractedTitle(title) {
  if (!noisyTitlePattern.test(title)) {
    return title
  }

  for (const pattern of assignmentTailPatterns) {
    const match = title.match(pattern)

    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return stripIteratively(title, trailingTitleNoisePatterns)
}

export function extractTitleFromChunk(chunk) {
  let title = String(chunk ?? '').trim()
  const quoted = title.match(/^["“](.+)["”]$/)

  if (quoted?.[1]) {
    title = quoted[1].trim()
  }

  title = stripIteratively(title, leadingTitleNoisePatterns)
  title = stripIteratively(title, trailingTitleNoisePatterns)
  title = cleanFollowUpTitle(title)
  title = refineExtractedTitle(title)

  if (!title || /^(?:cv|resume|portfolio|curriculum vitae)$/i.test(title)) {
    return ''
  }

  return title
}

function enrolledCourseCodeSet(offerings = []) {
  return new Set(
    offerings
      .map((offering) => String(offering.course?.code ?? offering.code ?? '').toUpperCase())
      .filter(Boolean),
  )
}

export function extractCourseAnchoredTargets(text, offerings = []) {
  const prepared = stripCvPreamble(text)

  if (!prepared) {
    return []
  }

  const enrolledCodes = enrolledCourseCodeSet(offerings)
  const allowAnyCode = enrolledCodes.size === 0
  const codePattern = /\b(?:(?:in|for)\s+)?([A-Za-z]{2,4}\d{4,5})\b/gi
  const matches = [...prepared.matchAll(codePattern)].filter((match) => {
    const code = String(match[1]).toUpperCase()

    return allowAnyCode || enrolledCodes.has(code)
  })

  if (matches.length === 0) {
    return []
  }

  const targets = []
  let prevEnd = 0

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const courseCode = String(match[1]).toUpperCase()
    const codeStart = match.index ?? 0
    const codeEnd = codeStart + match[0].length
    let title = extractTitleFromChunk(prepared.slice(prevEnd, codeStart))

    if (!title) {
      const nextStart = index + 1 < matches.length ? (matches[index + 1].index ?? prepared.length) : prepared.length
      title = extractTitleFromChunk(prepared.slice(codeEnd, nextStart))
    }

    title = title.replace(/\s+(?:course|subject|unit|class)\s*$/i, '').trim()

    prevEnd = codeEnd

    if (!title) {
      continue
    }

    targets.push({
      courseCode,
      mode: 'named',
      title,
    })
  }

  return targets
}

export function stripCvPreamble(text) {
  let stripped = String(text ?? '').trim()

  stripped = stripped.replace(cvTrailingSuffixPattern, '').trim()
  stripped = stripped.replace(cvTrailingFillerPattern, '').trim()
  stripped = stripped.replace(cvPreamblePattern, '').trim()

  return stripped
}

function buildClarificationSyntheticMessage(targets = []) {
  const parts = targets.map((target) => `"${target.title}" in ${target.courseCode}`)

  if (parts.length === 1) {
    return `Make a CV entry for ${parts[0]}`
  }

  return `Make CV entries for ${parts.join(' and ')}`
}

export function parseCvClarificationReply(message, offerings = []) {
  const targets = extractCourseAnchoredTargets(message, offerings)

  if (targets.length === 0) {
    return null
  }

  return {
    fromClarification: true,
    syntheticMessage: buildClarificationSyntheticMessage(targets),
    targets: targets.map((target) => ({ ...target, exactTitle: true })),
  }
}

function applyFollowUpRequestOverrides(request, followUp) {
  if (!followUp || request.targets.length === 0) {
    return request
  }

  if (followUp.fromClarification && Array.isArray(followUp.targets) && followUp.targets.length > 0) {
    return { ...request, targets: followUp.targets }
  }

  if (followUp.fromListPick) {
    return {
      ...request,
      targets: request.targets.map((target) => ({ ...target, exactTitle: true })),
    }
  }

  return request
}

export function parseCvFollowUp(message, history = [], offerings = []) {
  const text = String(message ?? '').trim()

  if (!text || isCvPortfolioRequest(text) || isCvTopicChange(text)) {
    return null
  }

  const clarification = parseCvClarificationReply(text, offerings)

  if (clarification) {
    return clarification
  }

  const courseCode = extractCourseCodeFromCvHistory(history, offerings)

  if (!courseCode) {
    return null
  }

  let title = ''

  const explicitPatterns = [
    /(?:oh\s+)?(?:the assignment (?:i want )?is|i mean(?:t)?)\s+(.+)/i,
    /sorry,?\s*(?:my mistake\s*)?(?:the assignment (?:i want )?is\s*)?(.+)/i,
  ]

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern)

    if (match?.[1]) {
      title = cleanFollowUpTitle(match[1])
      break
    }
  }

  if (!title && text.length <= 80 && !isCvTopicChange(text)) {
    title = cleanFollowUpTitle(text)
  }

  if (!title) {
    return null
  }

  const resolvedTitle = resolveFollowUpTitle(title, history)

  if (resolvedTitle.status === 'list_reference_ambiguous') {
    return {
      candidates: resolvedTitle.ambiguous,
      courseCode,
      query: resolvedTitle.query,
      status: 'list_reference_ambiguous',
    }
  }

  title = resolvedTitle.title

  return {
    courseCode,
    fromListPick: Boolean(resolvedTitle.fromListPick),
    syntheticMessage: `Make a CV entry for "${title}" in ${courseCode}`,
    title,
  }
}

export function parseCvProjectRequest(message, offerings = []) {
  const text = String(message ?? '')
  const courseCodes = [...parseCourseCodesFromMessage(text, offerings)]
  const mode = allAssignmentsPattern.test(text) ? 'all' : 'named'
  const targets = []

  if (mode === 'all') {
    for (const courseCode of courseCodes) {
      targets.push({ courseCode, mode: 'all' })
    }
  } else {
    let pairMatch

    quotedPairPattern.lastIndex = 0

    while ((pairMatch = quotedPairPattern.exec(text)) !== null) {
      targets.push({
        courseCode: String(pairMatch[2]).toUpperCase(),
        mode: 'named',
        title: pairMatch[1].trim(),
      })
    }

    if (targets.length === 0) {
      let title = ''
      const quoted = text.match(quotedTitlePattern)

      if (quoted?.[1]) {
        title = quoted[1].trim()
      } else {
        const inline = text.match(inCourseTitlePattern)

        if (inline?.[1]) {
          title = inline[1].trim()
          const inlineCourseCode = String(inline[2] ?? '').toUpperCase()

          if (inlineCourseCode && !courseCodes.includes(inlineCourseCode)) {
            courseCodes.push(inlineCourseCode)
          }
        }
      }

      const courseCode = courseCodes[0] ?? ''

      if (title && courseCode) {
        targets.push({ courseCode, mode: 'named', title })
      }
    }

    if (targets.length === 0) {
      const clarification = parseCvClarificationReply(text, offerings)

      if (clarification?.targets?.length) {
        targets.push(...clarification.targets)
      }
    }
  }

  const uniqueCourseCodes = [...new Set([...courseCodes, ...targets.map((target) => target.courseCode)])]

  return {
    courseCodes: uniqueCourseCodes,
    isCvRequest: isCvPortfolioRequest(text),
    mode,
    targets,
    titles: targets.filter((target) => target.title).map((target) => target.title),
  }
}

export function matchAssignmentsByTitle(assignments = [], titleQuery, { exactOnly = false } = {}) {
  const normalizedQuery = normalizeTitle(titleQuery)

  if (!normalizedQuery) {
    return []
  }

  const exactMatches = assignments.filter(
    (assignment) => normalizeTitle(assignment.title) === normalizedQuery,
  )

  if (exactOnly || exactMatches.length === 1) {
    return exactMatches
  }

  const queryTokens = dropLeadingNoiseTokens(
    dropTrailingNoiseTokens(normalizedQuery.split(' ').filter(Boolean)),
  )

  return assignments.filter((assignment) => {
    const titleTokens = normalizeTitle(assignment.title).split(' ').filter(Boolean)

    if (titleTokens.length === 0 || queryTokens.length === 0) {
      return false
    }

    if (queryTokens.length > titleTokens.length) {
      return false
    }

    for (let index = 0; index < queryTokens.length; index += 1) {
      if (titleTokens[index] !== queryTokens[index]) {
        return false
      }
    }

    return true
  })
}

export function inferProjectRole({ submissionText = '', githubText = '', filePaths = [] } = {}) {
  const haystack = `${submissionText} ${githubText}`.toLowerCase()
  const evidence = []
  const hasFrontend = frontendTech.some((tech) => {
    if (haystack.includes(tech)) {
      evidence.push(tech)
      return true
    }

    return false
  })
  const hasBackend = backendTech.some((tech) => {
    if (haystack.includes(tech)) {
      evidence.push(tech)
      return true
    }

    return false
  })
  const hasData = dataTech.some((tech) => {
    if (haystack.includes(tech)) {
      evidence.push(tech)
      return true
    }

    return false
  })

  for (const filePath of filePaths) {
    const extension = path.extname(String(filePath)).toLowerCase()

    if (['.css', '.html', '.jsx', '.tsx', '.vue'].includes(extension) && !evidence.includes(extension)) {
      evidence.push(extension)
    }
  }

  if (hasFrontend && hasBackend) {
    return { evidence: [...new Set(evidence)].slice(0, 6), role: 'Full Stack' }
  }

  if (hasFrontend) {
    return { evidence: [...new Set(evidence)].slice(0, 6), role: 'Frontend' }
  }

  if (hasBackend) {
    return { evidence: [...new Set(evidence)].slice(0, 6), role: 'Backend' }
  }

  if (hasData) {
    return { evidence: [...new Set(evidence)].slice(0, 6), role: 'Data/ML' }
  }

  return { evidence: [], role: 'General' }
}

export function collectCvTechEvidence({ submissionText = '', githubText = '', filePaths = [] } = {}) {
  const haystack = `${submissionText} ${githubText}`.toLowerCase()
  const tools = new Set()
  const allTech = [...frontendTech, ...backendTech, ...dataTech]

  for (const tech of allTech) {
    if (haystack.includes(tech)) {
      tools.add(tech)
    }
  }

  for (const filePath of filePaths) {
    const extension = path.extname(String(filePath)).toLowerCase()

    if (['.css', '.html', '.jsx', '.tsx', '.vue'].includes(extension)) {
      tools.add(extension)
    }
  }

  const roleHint = inferProjectRole({ filePaths, githubText, submissionText })

  return {
    role: roleHint.role,
    tools: [...tools],
  }
}

const buildTeacherAssignmentDocument = (offering, assignment) => {
  const courseCode = offering.course.code
  const label = `${courseCode} - ${offering.course.title}`
  const plainText = htmlToPlainText(
    assignment.contentHtml ?? assignment.content_html ?? assignment.description ?? '',
  )
  const lines = [
    `Course: ${label}`,
    'Teacher assignment:',
    `Title: ${assignment.title}`,
  ]

  if (assignment.dueAt ?? assignment.due_at) {
    lines.push(`Due: ${new Date(assignment.dueAt ?? assignment.due_at).toISOString()}`)
  }

  if (assignment.pointsPossible ?? assignment.points_possible) {
    lines.push(`Points: ${assignment.pointsPossible ?? assignment.points_possible}`)
  }

  if (plainText) {
    lines.push('Description:', plainText)
  }

  return {
    assignmentId: assignment.id,
    courseCode,
    id: `assignment:${assignment.id}`,
    offeringId: offering.id,
    source: 'assignment_definition',
    text: lines.join('\n'),
    title: `${label} / Assignment / ${assignment.title}`,
  }
}

export async function buildCvContextDocuments({
  fetchGithub,
  offering,
  projects = [],
}) {
  const documents = []

  for (const project of projects) {
    documents.push(buildTeacherAssignmentDocument(offering, project.assignment))

    const { segments } = await buildSubmissionSegments({
      assignment: project.assignment,
      fetchGithub,
      offering,
      submission: project.submission,
    })

    const roleHint = inferProjectRole({
      filePaths: Array.isArray(project.submission.filePaths) ? project.submission.filePaths : [],
      githubText: segments[0]?.text ?? '',
      submissionText: String(project.submission.body ?? ''),
    })

    for (const segment of segments) {
      const roleLine =
        roleHint.role !== 'General'
          ? `Inferred contribution: ${roleHint.role}${roleHint.evidence.length ? ` (${roleHint.evidence.join(', ')})` : ''}`
          : 'Inferred contribution: General (insufficient evidence for Frontend/Backend/Data role)'

      documents.push({
        assignmentId: project.assignment.id,
        courseCode: offering.course.code,
        id: `submission:${project.submission.id}`,
        offeringId: offering.id,
        source: 'submission',
        text: `${segment.text}\n${roleLine}`,
        title: segment.title,
      })
    }
  }

  return documents
}

export function buildCvScopeReply({
  assignmentTitles = [],
  candidates = [],
  courseCode = '',
  failures = [],
  status,
  title = '',
  targetResults = [],
} = {}) {
  if (status === 'blocked') {
    const lines = ['You asked for CV entries for:']

    for (const result of targetResults) {
      const label = result.target.title
        ? `"${result.target.title}" in ${result.target.courseCode}`
        : `all assignments in ${result.target.courseCode}`

      if (result.status === 'ready') {
        lines.push(`- ${label} — submitted`)
      } else if (result.status === 'named_unsubmitted') {
        lines.push(`- ${label} — you have not submitted this assignment yet`)
      } else if (result.status === 'not_found') {
        lines.push(`- ${label} — no assignment with that name in ${result.courseCode}`)
      } else if (result.status === 'ambiguous') {
        lines.push(`- ${label} — matches more than one assignment`)
      } else if (result.status === 'no_submissions') {
        lines.push(`- ${label} — you have not submitted any assignments in this course`)
      } else {
        lines.push(`- ${label} — unavailable`)
      }
    }

    lines.push('', 'I cannot generate the CV until every requested assignment is found and submitted.')

    const notFoundResults = failures.filter(
      (failure) => failure.status === 'not_found' && failure.assignmentTitles?.length > 0,
    )

    if (notFoundResults.length > 0) {
      lines.push('')

      for (const result of notFoundResults) {
        lines.push(`Assignments in ${result.courseCode}:`)
        result.assignmentTitles.forEach((assignmentTitle, index) => {
          lines.push(`${index + 1}. ${assignmentTitle}`)
        })
        lines.push('')
      }
    }

    const unsubmitted = failures.filter((failure) => failure.status === 'named_unsubmitted')

    if (unsubmitted.length > 0) {
      lines.push('Submit these before exporting to your CV:')

      for (const failure of unsubmitted) {
        lines.push(`- "${failure.title}" in ${failure.courseCode}`)
      }

      lines.push('')
    }

    lines.push(
      'Reply with the exact assignment titles and course codes you want. For example:',
      'Make CV entries for "Assignment 2" in COS20019 and "Week 5" in COS30043',
    )

    return lines.join('\n')
  }

  if (status === 'not_found') {
    const list = assignmentTitles.map((assignmentTitle, index) => `${index + 1}. ${assignmentTitle}`).join('\n')

    return [
      `I couldn't find an assignment with that name in ${courseCode}.`,
      '',
      `Here are the assignments in that course — which one did you mean?`,
      list,
    ].join('\n')
  }

  if (status === 'list_reference_ambiguous') {
    const list = candidates.map((assignment, index) => `${index + 1}. ${assignment.title}`).join('\n')

    return [
      `I'm not sure which assignment you mean by "${title}" in ${courseCode}.`,
      '',
      'Did you mean one of these?',
      list,
    ].join('\n')
  }

  if (status === 'ambiguous') {
    const list = candidates.map((assignment, index) => `${index + 1}. ${assignment.title}`).join('\n')

    return [
      `I found more than one assignment that could match "${title}" in ${courseCode}.`,
      '',
      'Which one did you have in mind?',
      list,
    ].join('\n')
  }

  if (status === 'named_unsubmitted') {
    return [
      `"${title}" isn't in your submissions for ${courseCode} yet, so I can't add it to your CV right now.`,
      'Submit the assignment first, then ask again and we can draft the entry.',
    ].join(' ')
  }

  if (status === 'no_submissions') {
    return [
      `I don't see any submitted assignments in ${courseCode} yet, so there's no project to add to your CV.`,
      'Once you submit work, come back and I can help you turn it into a CV entry.',
    ].join(' ')
  }

  if (status === 'missing_course') {
    return 'Please include a course code in your CV request — for example: Make a CV entry for "Capstone Project" in COS30034.'
  }

  return "I couldn't work out which submitted project you want in your CV. Try naming the assignment and course code."
}

function resolveCvProjectTarget({
  offerings = [],
  studentId,
  submissions = [],
  target,
}) {
  const courseCode = target.courseCode

  if (!courseCode) {
    return { status: 'missing_course', target }
  }

  const offering = offerings.find(
    (entry) => String(entry.course.code).toUpperCase() === String(courseCode).toUpperCase(),
  )

  if (!offering) {
    return { courseCode, status: 'missing_course', target }
  }

  const assignments = offering.assignments ?? []
  const assignmentTitles = assignments.map((assignment) => assignment.title)
  const submissionByAssignmentId = new Map(
    submissions
      .filter((submission) => submission.studentId === studentId)
      .map((submission) => [submission.assignmentId, submission]),
  )

  if (target.mode === 'all') {
    const projects = assignments
      .filter((assignment) => submissionByAssignmentId.has(assignment.id))
      .map((assignment) => ({
        assignment,
        submission: submissionByAssignmentId.get(assignment.id),
      }))
    const skippedUnsubmitted = assignments
      .filter((assignment) => !submissionByAssignmentId.has(assignment.id))
      .map((assignment) => assignment.title)

    if (projects.length === 0) {
      return {
        courseCode: offering.course.code,
        offering,
        status: 'no_submissions',
        target,
      }
    }

    return {
      courseCode: offering.course.code,
      offering,
      projects,
      skippedUnsubmitted,
      status: 'ready',
      target,
    }
  }

  const titleQuery = target.title ?? ''

  if (!titleQuery) {
    return {
      assignmentTitles,
      courseCode: offering.course.code,
      status: 'not_found',
      target,
    }
  }

  const matches = matchAssignmentsByTitle(assignments, titleQuery, {
    exactOnly: Boolean(target.exactTitle),
  })

  if (matches.length === 0) {
    return {
      assignmentTitles,
      courseCode: offering.course.code,
      status: 'not_found',
      target,
      title: titleQuery,
    }
  }

  if (matches.length > 1) {
    return {
      candidates: matches,
      courseCode: offering.course.code,
      status: 'ambiguous',
      target,
      title: titleQuery,
    }
  }

  const assignment = matches[0]
  const submission = submissionByAssignmentId.get(assignment.id)

  if (!submission) {
    return {
      assignment,
      courseCode: offering.course.code,
      status: 'named_unsubmitted',
      target,
      title: assignment.title,
    }
  }

  return {
    courseCode: offering.course.code,
    offering,
    projects: [{ assignment, submission }],
    status: 'ready',
    target,
  }
}

export async function resolveCvProjects({
  offerings = [],
  request,
  studentId,
  submissions = [],
}) {
  const targets =
    request.targets?.length > 0
      ? request.targets
      : request.courseCodes[0]
        ? [
            {
              courseCode: request.courseCodes[0],
              mode: request.mode,
              title: request.titles?.[0],
            },
          ]
        : []

  if (targets.length === 0) {
    return { status: 'missing_course' }
  }

  const targetResults = targets.map((target) =>
    resolveCvProjectTarget({
      offerings,
      studentId,
      submissions,
      target,
    }),
  )
  const failures = targetResults.filter((result) => result.status !== 'ready')

  if (failures.length > 0) {
    if (targetResults.length === 1) {
      return { ...failures[0], targetResults }
    }

    return {
      failures,
      status: 'blocked',
      targetResults,
    }
  }

  const projects = targetResults.flatMap((result) => result.projects ?? [])
  const skippedUnsubmitted = targetResults.flatMap((result) => result.skippedUnsubmitted ?? [])

  return {
    courseCode: targetResults[0]?.courseCode ?? '',
    projects,
    skippedUnsubmitted,
    status: 'ready',
    targetResults,
  }
}

export async function resolveCvProjectsByAssignmentIds({
  assignmentIds = [],
  offerings = [],
  prisma,
  studentId,
}) {
  const normalizedIds = [...new Set(assignmentIds.map((id) => String(id).trim()).filter(Boolean))]

  if (normalizedIds.length === 0) {
    return {
      assistantText: 'Select at least one submitted project for your Perfect CV.',
      status: 'missing_assignments',
    }
  }

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      assignmentId: { in: normalizedIds },
      studentId,
    },
    include: { assignment: true },
  })
  const submissionByAssignmentId = new Map(
    submissions.map((submission) => [submission.assignmentId, submission]),
  )
  const missingIds = normalizedIds.filter((id) => !submissionByAssignmentId.has(id))

  if (missingIds.length > 0) {
    return {
      assistantText:
        'One or more selected projects are not in your submissions yet. Submit them first, then try again.',
      missingIds,
      status: 'not_submitted',
    }
  }

  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]))
  const projects = []

  for (const assignmentId of normalizedIds) {
    const submission = submissionByAssignmentId.get(assignmentId)
    const offering = offeringById.get(submission.assignment.offeringId)

    if (!offering) {
      return {
        assistantText:
          'One or more selected projects are outside your enrolled courses. Refresh and try again.',
        status: 'missing_offering',
      }
    }

    projects.push({
      assignment: submission.assignment,
      submission,
    })
  }

  return {
    projects,
    status: 'ready',
  }
}

export function mapSubmissionFileUrls(filePaths = []) {
  return filePaths.map((filePath) => {
    const normalized = String(filePath).replace(/\\/g, '/')
    const name = path.basename(normalized)

    return {
      name,
      url: normalized.startsWith('/') ? normalized : `/${normalized}`,
    }
  })
}

export async function prepareCvTurn({
  forceCv = false,
  history = [],
  message,
  offeringIds = [],
  prisma,
  studentId,
  loadOfferingKnowledge,
}) {
  const offerings = (
    await Promise.all(offeringIds.map((offeringId) => loadOfferingKnowledge(prisma, offeringId)))
  ).filter(Boolean)
  const offeringSummaries = offerings.map((offering) => ({ course: offering.course }))

  let effectiveMessage = message
  let followUp = null

  if (!isCvPortfolioRequest(message) && detectCvThreadContext(history)) {
    followUp = parseCvFollowUp(message, history, offeringSummaries)

    if (followUp?.status === 'list_reference_ambiguous') {
      return {
        assistantText: buildCvScopeReply({
          candidates: followUp.candidates.map((candidate) => ({ title: candidate })),
          courseCode: followUp.courseCode,
          status: 'list_reference_ambiguous',
          title: followUp.query,
        }),
        followUp,
        request: parseCvProjectRequest(message, offeringSummaries),
        resolution: followUp,
        status: 'list_reference_ambiguous',
      }
    }

    if (followUp) {
      effectiveMessage = followUp.syntheticMessage
      forceCv = true
    }
  }

  let request = applyFollowUpRequestOverrides(
    parseCvProjectRequest(effectiveMessage, offeringSummaries),
    followUp,
  )

  if (forceCv && request.targets.length === 0 && detectCvThreadContext(history)) {
    followUp = followUp ?? parseCvFollowUp(message, history, offeringSummaries)

    if (followUp?.status === 'list_reference_ambiguous') {
      return {
        assistantText: buildCvScopeReply({
          candidates: followUp.candidates.map((candidate) => ({ title: candidate })),
          courseCode: followUp.courseCode,
          status: 'list_reference_ambiguous',
          title: followUp.query,
        }),
        followUp,
        request,
        resolution: followUp,
        status: 'list_reference_ambiguous',
      }
    }

    if (followUp) {
      effectiveMessage = followUp.syntheticMessage
      request = applyFollowUpRequestOverrides(
        parseCvProjectRequest(effectiveMessage, offeringSummaries),
        followUp,
      )
    }
  }

  if (!request.isCvRequest && !forceCv) {
    return { request, status: 'not_cv' }
  }

  const scopedOfferingIds =
    request.courseCodes.length > 0
      ? offerings
          .filter((offering) =>
            request.courseCodes.some(
              (code) => code === String(offering.course.code).toUpperCase(),
            ),
          )
          .map((offering) => offering.id)
      : offeringIds

  const scopedOfferings = offerings.filter((offering) => scopedOfferingIds.includes(offering.id))
  const submissions = scopedOfferingIds.length
    ? await prisma.assignmentSubmission.findMany({
        where: {
          studentId,
          assignment: { offeringId: { in: scopedOfferingIds } },
        },
        include: { assignment: true },
      })
    : []

  const resolution = await resolveCvProjects({
    offerings: scopedOfferings,
    request,
    studentId,
    submissions,
  })

  if (resolution.status !== 'ready') {
    return {
      assistantText: buildCvScopeReply(resolution),
      followUp,
      request,
      resolution,
      status: resolution.status,
    }
  }

  const documents = []

  for (const offering of scopedOfferings.filter((entry) =>
    resolution.projects.some((project) => project.assignment.offeringId === entry.id),
  )) {
    const projects = resolution.projects.filter((project) => project.assignment.offeringId === offering.id)
    documents.push(
      ...(await buildCvContextDocuments({
        offering,
        projects,
      })),
    )
  }

  return {
    assignmentIds: resolution.projects.map((project) => project.assignment.id),
    documents,
    followUp,
    request,
    resolution,
    skippedUnsubmitted: resolution.skippedUnsubmitted ?? [],
    status: 'ready',
  }
}

function formatAssignmentTitleList(titles = []) {
  if (titles.length === 0) {
    return ''
  }

  if (titles.length === 1) {
    return `"${titles[0]}"`
  }

  if (titles.length === 2) {
    return `"${titles[0]}" and "${titles[1]}"`
  }

  const last = titles[titles.length - 1]

  return `${titles
    .slice(0, -1)
    .map((title) => `"${title}"`)
    .join(', ')}, and "${last}"`
}

function assignmentCountLabel(count) {
  if (count === 1) {
    return 'one assignment'
  }

  return `${count} assignments`
}

function buildSubmittedAssignmentCourseReply(course) {
  const titles = course.assignments.map((assignment) => assignment.title)
  const count = titles.length
  const code = course.course_code

  if (count === 0) {
    return `I checked ${code} and don't see any submitted assignments on your account yet.`
  }

  if (count === 1) {
    return `In ${code}, you've submitted one assignment so far: ${formatAssignmentTitleList(titles)}.`
  }

  return `In ${code}, you've submitted ${assignmentCountLabel(count)}: ${formatAssignmentTitleList(titles)}.`
}

function buildSubmittedAssignmentConfirmationReply(courses = [], courseCode = '', message = '') {
  const normalizedCourseCode = String(courseCode ?? '').toUpperCase()
  const filtered = normalizedCourseCode
    ? courses.filter((course) => String(course.course_code).toUpperCase() === normalizedCourseCode)
    : courses
  const course = filtered[0]
  const titles = course?.assignments?.map((assignment) => assignment.title) ?? []
  const count = titles.length
  const code = course?.course_code ?? normalizedCourseCode
  const text = String(message ?? '').trim()

  if (count === 0) {
    return code
      ? `That's right — I still don't see any submitted assignments in ${code}.`
      : "That's right — I don't see any submitted assignments in your selected courses yet."
  }

  if (/^(?:really|are you sure|is that (?:right|correct|all)|that'?s (?:it|all)|correct)\??$/i.test(text)) {
    if (count === 1) {
      return `That's right. ${formatAssignmentTitleList(titles)} is the only submission I can see for ${code}.`
    }

    return `That's right. In ${code}, you've submitted ${assignmentCountLabel(count)}: ${formatAssignmentTitleList(titles)}.`
  }

  if (count === 1) {
    return `Yes — so far you've only submitted one assignment in ${code}: ${formatAssignmentTitleList(titles)}.`
  }

  return `Yes — in ${code} you've submitted ${assignmentCountLabel(count)}: ${formatAssignmentTitleList(titles)}.`
}

export function buildSubmittedAssignmentsReply(courses = [], courseCode = '', options = {}) {
  const { history = [], message = '' } = options
  const normalizedCourseCode = String(courseCode ?? '').toUpperCase()
  const filtered = normalizedCourseCode
    ? courses.filter((course) => String(course.course_code).toUpperCase() === normalizedCourseCode)
    : courses

  if (isSubmittedAssignmentFollowUp(message, history)) {
    return buildSubmittedAssignmentConfirmationReply(filtered, normalizedCourseCode, message)
  }

  if (filtered.length === 0) {
    return normalizedCourseCode
      ? `I checked ${normalizedCourseCode} and don't see any submitted assignments on your account yet.`
      : "I don't see any submitted assignments in your selected courses yet."
  }

  const lines = filtered.map((course) => buildSubmittedAssignmentCourseReply(course))

  return lines.join('\n\n').trim()
}

export async function loadSubmittedProjectsForStudent({ offeringIds = [], prisma, studentId }) {
  if (!studentId || offeringIds.length === 0) {
    return []
  }

  const offerings = await prisma.courseOffering.findMany({
    where: { id: { in: offeringIds } },
    include: {
      assignments: { orderBy: { dueAt: 'asc' } },
      course: true,
    },
    orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
  })

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      studentId,
      assignment: { offeringId: { in: offeringIds } },
    },
    include: { assignment: true },
    orderBy: { submittedAt: 'desc' },
  })

  const submissionByAssignmentId = new Map(submissions.map((submission) => [submission.assignmentId, submission]))

  return offerings.map((offering) => ({
    course_code: offering.course.code,
    course_title: offering.course.title,
    offering_id: offering.id,
    assignments: offering.assignments
      .filter((assignment) => submissionByAssignmentId.has(assignment.id))
      .map((assignment) => {
        const submission = submissionByAssignmentId.get(assignment.id)
        const filePaths = Array.isArray(submission.filePaths) ? submission.filePaths : []

        return {
          assignment_id: assignment.id,
          body_preview: String(submission.body ?? '').slice(0, 240),
          file_count: filePaths.length,
          files: mapSubmissionFileUrls(filePaths),
          github_url: submission.githubUrl ?? null,
          submitted_at: submission.submittedAt.toISOString(),
          title: assignment.title,
        }
      }),
  }))
}
