import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const loadTsModule = async (relativePath) => {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript,${encodeURIComponent(transpiled.outputText)}`)
}

const {
  buildCourseDetailPath,
  courseDetailSectionLabels,
  courseDetailSections,
  isCourseDetailSection,
  scrollCourseContentIntoView,
  summarizeCourseDetail,
} = await loadTsModule('./courseDetailSections.ts')

test('normalizes the allowed course detail sections', () => {
  assert.deepEqual(courseDetailSections, ['home', 'modules', 'assignments', 'grades'])
  assert.equal(isCourseDetailSection('modules'), true)
  assert.equal(isCourseDetailSection('announcements'), false)
})

test('builds stable section paths for role course routes', () => {
  assert.equal(
    buildCourseDetailPath('student', 'course 101', 'assignments'),
    '/student/my-courses/course%20101/assignments',
  )
  assert.equal(courseDetailSectionLabels.grades, 'Grades')
})

test('summarizes imported course content and upcoming assignments', () => {
  const summary = summarizeCourseDetail({
    assignments: [
      {
        due_at: '2026-02-02T00:00:00.000Z',
        id: 'past',
        points_possible: 10,
        title: 'Past assignment',
      },
      {
        due_at: '2026-03-03T00:00:00.000Z',
        id: 'future',
        points_possible: 20,
        title: 'Future assignment',
      },
    ],
    contentPackage: {
      asset_count: 3,
      module_count: 2,
    },
    currentTimestamp: Date.parse('2026-02-15T00:00:00.000Z'),
    memberCount: 5,
    teacherCount: 1,
  })

  assert.equal(summary.moduleCount, 2)
  assert.equal(summary.assignmentCount, 2)
  assert.equal(summary.fileCount, 3)
  assert.equal(summary.memberCount, 5)
  assert.equal(summary.teacherCount, 1)
  assert.equal(summary.upcomingAssignment?.id, 'future')
})

test('schedules course content panel scroll when a module item opens', () => {
  let scheduled = false
  let scrollOptions = null
  let panelScrollOptions = null
  const target = {
    scrollIntoView(options) {
      scrollOptions = options
    },
    scrollTo(options) {
      panelScrollOptions = options
    },
  }

  scrollCourseContentIntoView(target, (callback) => {
    scheduled = true
    callback()
  })

  assert.equal(scheduled, true)
  assert.deepEqual(scrollOptions, {
    behavior: 'smooth',
    block: 'start',
  })
  assert.deepEqual(panelScrollOptions, {
    behavior: 'smooth',
    top: 0,
  })
})
