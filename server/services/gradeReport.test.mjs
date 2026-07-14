import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import zlib from 'node:zlib'
import { describe, it } from 'node:test'

import {
  buildFilteredGradeReport,
  buildGradeReport,
  buildGradeReportWorkbook,
  buildGradeReportPdf,
  extractGradeFilterTokens,
  formatGradeReportCsv,
  formatGradeReportMarkdown,
  formatStudentInfo,
  isGradeRefinementRequest,
  warningTierForScore,
} from './gradeReport.js'

const sampleProgress = {
  total_credit_points: 25,
  passed_course_count: 2,
  completed_courses: [
    {
      id: '1',
      course_id: 'c1',
      code: 'COS10001',
      title: 'Intro',
      final_score: 45,
      grade: 'F',
      grade_label: 'Fail',
      credit_points: 12.5,
      counts_toward_total: false,
      earned_credit_points: 0,
      completed_at: '2026-01-15T00:00:00.000Z',
    },
    {
      id: '2',
      course_id: 'c2',
      code: 'COS10002',
      title: 'Programming',
      final_score: 55,
      grade: 'P',
      grade_label: 'Pass',
      credit_points: 12.5,
      counts_toward_total: true,
      earned_credit_points: 12.5,
      completed_at: '2026-02-15T00:00:00.000Z',
    },
    {
      id: '3',
      course_id: 'c3',
      code: 'COS10003',
      title: 'Data',
      final_score: 65,
      grade: 'C',
      grade_label: 'Credit',
      credit_points: 12.5,
      counts_toward_total: true,
      earned_credit_points: 12.5,
      completed_at: '2026-03-15T00:00:00.000Z',
    },
    {
      id: '4',
      course_id: 'c4',
      code: 'COS10004',
      title: 'Web',
      final_score: 85,
      grade: 'HD',
      grade_label: 'High Distinction',
      credit_points: 12.5,
      counts_toward_total: true,
      earned_credit_points: 12.5,
      completed_at: '2026-04-15T00:00:00.000Z',
    },
  ],
}

describe('gradeReport', () => {
  it('maps score boundaries to warning tiers', () => {
    assert.equal(warningTierForScore(49), 'critical')
    assert.equal(warningTierForScore(50), 'warning')
    assert.equal(warningTierForScore(59), 'warning')
    assert.equal(warningTierForScore(60), 'info')
    assert.equal(warningTierForScore(69), 'info')
    assert.equal(warningTierForScore(70), null)
    assert.equal(warningTierForScore(100), null)
  })

  it('enriches progress with warning fields and summary', () => {
    const report = buildGradeReport(sampleProgress)

    assert.equal(report.completed_courses[0].warning_tier, 'critical')
    assert.equal(report.completed_courses[0].warning_message, 'Fail - immediate attention needed')
    assert.equal(report.completed_courses[1].warning_tier, 'warning')
    assert.equal(report.completed_courses[2].warning_tier, 'info')
    assert.equal(report.completed_courses[3].warning_tier, null)
    assert.deepEqual(report.warning_summary, { critical: 1, warning: 1, info: 1, total: 3 })
  })

  it('formats markdown with attention section', () => {
    const markdown = formatGradeReportMarkdown(buildGradeReport(sampleProgress))

    assert.match(markdown, /## Grade table/)
    assert.match(markdown, /### Attention needed/)
    assert.match(markdown, /COS10001/)
    assert.match(markdown, /Fail - immediate attention needed/)
  })

  it('formats empty markdown when no courses', () => {
    const markdown = formatGradeReportMarkdown(buildGradeReport({ completed_courses: [] }))

    assert.match(markdown, /No completed courses recorded yet/)
  })

  it('escapes commas and quotes in CSV', () => {
    const report = buildGradeReport({
      completed_courses: [
        {
          code: 'COS10001',
          title: 'Intro, "Advanced"',
          final_score: 45,
          grade: 'F',
          grade_label: 'Fail',
          credit_points: 12.5,
          completed_at: '2026-01-15',
          warning_tier: 'critical',
          warning_message: 'Fail - immediate attention needed',
        },
      ],
    })

    const csv = formatGradeReportCsv(report)

    assert.match(csv, /"Intro, ""Advanced"""/)
    assert.match(csv, /Warning Tier/)
  })

  it('formats student info rows from a studentInfo object', () => {
    const info = formatStudentInfo({
      fullName: 'Jane Doe',
      studentId: 'S12345',
      major: 'Software Engineering - Artificial Intelligence',
    })

    assert.deepEqual(info, [
      { label: 'Full name', value: 'Jane Doe' },
      { label: 'Student ID', value: 'S12345' },
      { label: 'Major', value: 'Software Engineering - Artificial Intelligence' },
    ])
  })

  it('builds an xlsx workbook that is score-only with student info and no warning columns', async () => {
    const report = buildGradeReport(sampleProgress)
    const buffer = await buildGradeReportWorkbook(report, {
      fullName: 'Jane Doe',
      studentId: 'S12345',
      major: 'Software Engineering - Artificial Intelligence',
    })
    const workbook = new ExcelJS.Workbook()

    await workbook.xlsx.load(buffer)
    const worksheet = workbook.getWorksheet('Grades')

    assert.ok(worksheet)
    // 3 student-info rows + 1 blank + 1 header + 4 course rows
    assert.equal(worksheet.rowCount, 9)
    assert.equal(worksheet.getRow(1).getCell(1).value, 'Full name')
    assert.equal(worksheet.getRow(1).getCell(2).value, 'Jane Doe')
    assert.equal(worksheet.getRow(3).getCell(1).value, 'Major')
    assert.equal(worksheet.getRow(5).getCell(1).value, 'Code')
    // warning columns removed: header row contains no 'Warning' text
    const headerValues = worksheet.getRow(5).values
    assert.ok(!headerValues.some((value) => typeof value === 'string' && value.includes('Warning')))
    // first course row date is formatted
    assert.equal(worksheet.getRow(6).getCell(7).value, '2026-01-15')
  })

  it('builds a pdf buffer prefixed with %PDF and containing student info', async () => {
    const report = buildGradeReport(sampleProgress)
    const buffer = await buildGradeReportPdf(report, {
      fullName: 'Jane Doe',
      studentId: 'S12345',
      major: 'Software Engineering - Artificial Intelligence',
    })

    assert.ok(Buffer.isBuffer(buffer))
    assert.equal(buffer.slice(0, 5).toString('latin1'), '%PDF-')

    // pdfkit compresses its text streams and hex-encodes strings. Read the raw
    // buffer, inflate each content stream, and decode the hex string tokens.
    const decoded = []
    const marker = Buffer.from('stream\n')
    const endMarker = Buffer.from('endstream\n')
    let searchFrom = 0

    while (true) {
      const start = buffer.indexOf(marker, searchFrom)
      if (start === -1) {
        break
      }
      const dataStart = start + marker.length
      const end = buffer.indexOf(endMarker, dataStart)
      if (end === -1) {
        break
      }
      try {
        const inflated = zlib.inflateSync(buffer.subarray(dataStart, end)).toString('latin1')
        decoded.push(
          inflated.replace(/<([0-9A-Fa-f]+)>/g, (_match, hex) =>
            Buffer.from(hex, 'hex').toString('latin1'),
          ),
        )
      } catch {
        // non-text stream (e.g. font metadata) — ignore
      }
      searchFrom = end + endMarker.length
    }

    const text = decoded.join(' ')

    // The student-info section and course table render; warnings are excluded.
    // pdfkit kerns the combined major string and leaves adjustment numbers in
    // the stream, so strip everything but letters before matching.
    const flat = text.replace(/[^A-Za-z]/g, '')
    assert.match(text, /Full name:/)
    assert.match(text, /Major/i)
    assert.match(flat, /Software/i)
    assert.match(flat, /Engineering/i)
    assert.match(flat, /Artificial/i)
    assert.match(flat, /Intelligence/i)
    assert.match(text, /COS10001/)
    assert.ok(!text.includes('Attention needed'))
  })
})

describe('grade table refinement filtering', () => {
  const mixedReport = buildGradeReport({
    completed_courses: [
      { code: 'COS10009', title: 'Intro', final_score: 57, grade: 'P', credit_points: 12.5, earned_credit_points: 12.5, counts_toward_total: true, completed_at: '2026-01-01' },
      { code: 'COS10005', title: 'Web', final_score: 75, grade: 'D', credit_points: 12.5, earned_credit_points: 12.5, counts_toward_total: true, completed_at: '2026-01-01' },
      { code: 'COS10004', title: 'Systems', final_score: 50, grade: 'P', credit_points: 12.5, earned_credit_points: 12.5, counts_toward_total: true, completed_at: '2026-01-01' },
    ],
  })

  it('extracts grade tokens from free text', () => {
    assert.deepEqual(extractGradeFilterTokens('just show only the P one').sort(), ['P'])
    assert.deepEqual(extractGradeFilterTokens('show me the pass and distinction').sort(), ['D', 'P'])
    assert.deepEqual(extractGradeFilterTokens('the fails only').sort(), ['F'])
  })

  it('detects a refinement request with a filter word + grade token', () => {
    assert.equal(isGradeRefinementRequest('just show only the P one'), true)
    assert.equal(isGradeRefinementRequest('can you show me the course that i got the P grade only'), true)
    assert.equal(isGradeRefinementRequest('yes please analyze'), false)
    assert.equal(isGradeRefinementRequest('what is a variable'), false)
  })

  it('filters the report to the requested grades and recomputes totals', () => {
    const { report, matched } = buildFilteredGradeReport(mixedReport, 'only the P grades')

    assert.equal(matched, true)
    assert.equal(report.completed_courses.length, 2)
    assert.ok(report.completed_courses.every((course) => course.grade === 'P'))
    assert.equal(report.completed_courses.some((course) => course.code === 'COS10005'), false)
    assert.equal(report.total_credit_points, 25)
  })

  it('returns unmatched when no grade token is present', () => {
    const { report, matched } = buildFilteredGradeReport(mixedReport, 'sort by date')

    assert.equal(matched, false)
    assert.equal(report, mixedReport)
  })
})
