import ExcelJS from 'exceljs'

const WARNING_MESSAGES = {
  critical: 'Fail - immediate attention needed',
  warning: 'Bare pass - consider improvement',
  info: 'Below Credit band',
}

const GRADE_HEADERS = [
  'Code',
  'Title',
  'Final Score',
  'Grade',
  'Grade Label',
  'Credit Points',
  'Completed At',
  'Warning Tier',
  'Warning Message',
]

const GRADE_COLUMN_WIDTHS = [12, 36, 12, 8, 18, 14, 14, 14, 42]

export const warningTierForScore = (score) => {
  const value = Number(score)

  if (!Number.isFinite(value)) {
    return null
  }

  if (value < 50) {
    return 'critical'
  }

  if (value < 60) {
    return 'warning'
  }

  if (value < 70) {
    return 'info'
  }

  return null
}

const summarizeWarnings = (courses) => {
  const summary = { critical: 0, warning: 0, info: 0, total: 0 }

  for (const course of courses) {
    if (!course.warning_tier) {
      continue
    }

    summary[course.warning_tier] += 1
    summary.total += 1
  }

  return summary
}

export const enrichProgressWithWarnings = (progress) => {
  const completedCourses = (progress?.completed_courses ?? []).map((course) => {
    const warningTier = warningTierForScore(course.final_score)

    return {
      ...course,
      warning_tier: warningTier,
      warning_message: warningTier ? WARNING_MESSAGES[warningTier] : null,
    }
  })

  return {
    ...progress,
    completed_courses: completedCourses,
    warning_summary: summarizeWarnings(completedCourses),
  }
}

export const buildGradeReport = (progress) => enrichProgressWithWarnings(progress)

const escapeCsvCell = (value) => {
  const text = String(value ?? '')

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

const csvRow = (cells) => cells.map(escapeCsvCell).join(',')

export const formatGradeReportCsv = (report) => {
  const header = csvRow([
    'Code',
    'Title',
    'Final Score',
    'Grade',
    'Grade Label',
    'Credit Points',
    'Completed At',
    'Warning Tier',
    'Warning Message',
  ])

  const rows = (report?.completed_courses ?? []).map((course) =>
    csvRow([
      course.code,
      course.title,
      course.final_score,
      course.grade ?? '',
      course.grade_label ?? '',
      course.credit_points,
      course.completed_at ?? '',
      course.warning_tier ?? '',
      course.warning_message ?? '',
    ]),
  )

  return [header, ...rows].join('\n')
}

const formatCompletedAt = (value) => {
  if (!value) {
    return ''
  }

  const parsed = Date.parse(value)

  if (!Number.isFinite(parsed)) {
    return String(value).slice(0, 10)
  }

  return new Date(parsed).toISOString().slice(0, 10)
}

export const gradeReportWorkbookFilename = (prefix = 'swinlearn-grades') =>
  `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`

export async function buildGradeReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Grades')
  const headerRow = worksheet.addRow(GRADE_HEADERS)

  headerRow.font = { bold: true }

  for (const course of report?.completed_courses ?? []) {
    worksheet.addRow([
      course.code ?? '',
      course.title ?? '',
      course.final_score ?? '',
      course.grade ?? '',
      course.grade_label ?? '',
      course.credit_points ?? '',
      formatCompletedAt(course.completed_at),
      course.warning_tier ?? '',
      course.warning_message ?? '',
    ])
  }

  worksheet.columns = GRADE_HEADERS.map((header, index) => ({
    header,
    width: GRADE_COLUMN_WIDTHS[index],
  }))

  return workbook.xlsx.writeBuffer()
}

const formatCourseLine = (course) => {
  const gradeText = course.grade ? `${course.grade} (${course.grade_label})` : '-'

  return `${course.code} - ${course.title}: ${course.final_score} · ${gradeText}`
}

export const formatGradeReportMarkdown = (report) => {
  const courses = report?.completed_courses ?? []

  if (courses.length === 0) {
    return 'No completed courses recorded yet. Completed course grades appear here once an admin records them on your account.'
  }

  const lines = ['## Grade table', '']

  for (const course of courses) {
    const warningSuffix = course.warning_message ? ` - **${course.warning_message}**` : ''

    lines.push(`- ${formatCourseLine(course)}${warningSuffix}`)
  }

  const warned = courses.filter((course) => course.warning_tier)

  if (warned.length > 0) {
    lines.push('', '### Attention needed', '')

    for (const course of warned) {
      lines.push(`- **${course.code}** (${course.final_score}, ${course.grade}): ${course.warning_message}`)
    }
  }

  lines.push(
    '',
    `Total: ${courses.length} completed course${courses.length === 1 ? '' : 's'} · ${report.total_credit_points ?? 0} credit points earned`,
  )

  return lines.join('\n')
}

export const warningMessageForTier = (tier) => WARNING_MESSAGES[tier] ?? null

// Parse grade tokens (P/C/D/F/HD and common words) from a free-text refinement
// request so the bot can re-filter an already-shown grade table, e.g.
// "show only the P ones" or "just the fails".
const GRADE_TOKEN_PATTERNS = [
  { grade: 'HD', patterns: [/\bHD\b/i, /high distinction/i] },
  { grade: 'D', patterns: [/\bD\b(?!\w)/i, /distinction/i] },
  { grade: 'C', patterns: [/\bC\b(?!\w)/i, /\bcredit\b/i] },
  { grade: 'P', patterns: [/\bP\b(?!\w)/i, /\bpass\b/i, /bare pass/i] },
  { grade: 'F', patterns: [/\bF\b(?!\w)/i, /\bfail(?:s|ed)?\b/i] },
]

export const extractGradeFilterTokens = (message) => {
  const text = String(message ?? '')
  const grades = new Set()

  for (const { grade, patterns } of GRADE_TOKEN_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      grades.add(grade)
    }
  }

  return [...grades]
}

export const isGradeRefinementRequest = (message) => {
  const text = String(message ?? '')

  if (!/\b(only|just|show|filter|display|list|filter by|sort|which|that (?:i )?(?:got|have)|with)\b/i.test(text)) {
    return false
  }

  return extractGradeFilterTokens(text).length > 0
}

export const buildFilteredGradeReport = (report, message) => {
  const tokens = extractGradeFilterTokens(message)

  if (tokens.length === 0) {
    return { report, matched: false, tokens: [] }
  }

  const courses = (report?.completed_courses ?? []).filter((course) => tokens.includes(course.grade))
  const filtered = {
    ...report,
    completed_courses: courses,
    total_credit_points: courses.reduce(
      (total, course) => total + (Number(course.earned_credit_points) || Number(course.credit_points) || 0),
      0,
    ),
    passed_course_count: courses.filter((course) => course.counts_toward_total).length,
  }

  return { report: filtered, matched: true, tokens }
}
