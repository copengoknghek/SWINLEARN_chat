import type { Role } from '../../../../hooks/useAuth'

type SummaryAssignment = {
  due_at: string
  id: string
  points_possible: number | null
  title: string
}

type SummaryContentPackage = {
  asset_count: number
  module_count: number
} | null

type ScrollTarget = {
  scrollIntoView: (options?: ScrollIntoViewOptions) => void
  scrollTo?: (options?: ScrollToOptions) => void
  scrollTop?: number
} | null

type ScrollScheduler = (callback: () => void) => void

export const courseDetailSections = ['home', 'modules', 'assignments', 'grades'] as const

export type CourseDetailSection = (typeof courseDetailSections)[number]

export const courseDetailSectionLabels: Record<CourseDetailSection, string> = {
  assignments: 'Assignment',
  grades: 'Grades',
  home: 'Home',
  modules: 'Modules',
}

const courseDetailSectionSet = new Set<string>(courseDetailSections)

export function isCourseDetailSection(value: string | undefined): value is CourseDetailSection {
  return value !== undefined && courseDetailSectionSet.has(value)
}

export function buildCourseDetailPath(
  workspaceRole: Role,
  courseId: string,
  section: CourseDetailSection,
) {
  return `/${workspaceRole}/my-courses/${encodeURIComponent(courseId)}/${section}`
}

export function summarizeCourseDetail({
  assignments,
  contentPackage,
  currentTimestamp = Date.now(),
  memberCount,
  teacherCount,
}: {
  assignments: SummaryAssignment[]
  contentPackage: SummaryContentPackage
  currentTimestamp?: number
  memberCount: number
  teacherCount: number
}) {
  const upcomingAssignment =
    assignments
      .filter((assignment) => {
        const dueTime = new Date(assignment.due_at).getTime()

        return Number.isFinite(dueTime) && dueTime >= currentTimestamp
      })
      .sort(
        (first, second) =>
          new Date(first.due_at).getTime() - new Date(second.due_at).getTime(),
      )[0] ?? null

  return {
    assignmentCount: assignments.length,
    fileCount: contentPackage?.asset_count ?? 0,
    memberCount,
    moduleCount: contentPackage?.module_count ?? 0,
    teacherCount,
    upcomingAssignment,
  }
}

export function scrollCourseContentIntoView(
  target: ScrollTarget,
  schedule: ScrollScheduler = (callback) => window.requestAnimationFrame(callback),
) {
  if (!target) {
    return
  }

  schedule(() => {
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    if (typeof target.scrollTo === 'function') {
      target.scrollTo({
        behavior: 'smooth',
        top: 0,
      })
      return
    }

    target.scrollTop = 0
  })
}
