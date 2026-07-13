import { faPeopleRoof } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import type { Role } from '../../../../hooks/useAuth'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import {
  courseLabel,
  fetchAssignments,
  fetchWorkspaceCourses,
  getErrorMessage,
} from '../../lib/workspace/api'
import type {
  AssignmentRow,
  CourseTerm,
  CourseWithMembers,
} from '../../lib/workspace/types'
import { buildCourseDetailPath } from './courseDetailSections'

const termLabels: Record<CourseTerm, string> = {
  semester_1: 'Semester 1',
  semester_2: 'Semester 2',
  summer: 'Summer',
}

const toReadableDate = (isoValue: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoValue))

const courseCardIcons = {
  announcement: {
    pathData:
      'M3 11.5C3 9.57 4.57 8 6.5 8H9l9-4v16l-9-4H6.5C4.57 16 3 14.43 3 12.5v-1zm6 4.5v3.25c0 .41-.34.75-.75.75H7.4a.75.75 0 0 1-.72-.54L5.65 16H9zm12-7.5v7a2.5 2.5 0 0 0 0-7z',
    viewBox: '0 0 24 24',
  },
  edit: {
    pathData:
      'M5 4h10.5v2H7v12h12v-8.5h2V20H5V4zm12.08-.32a2.3 2.3 0 0 1 3.25 3.25l-7.66 7.66-4.17.92.92-4.17 7.66-7.66zm1.41 1.41-7.19 7.19-.26 1.18 1.18-.26 7.19-7.19a.3.3 0 0 0-.42-.42z',
    viewBox: '0 0 24 24',
  },
} as const

function CourseCardIcon({ name }: { name: keyof typeof courseCardIcons }) {
  const icon = courseCardIcons[name]

  return (
    <svg
      aria-hidden="true"
      className="workspace-course-card-action-svg"
      focusable="false"
      viewBox={icon.viewBox}
    >
      <path d={icon.pathData} />
    </svg>
  )
}

type CourseCardProps = {
  assignmentCount: number
  communityUnreadCount: number
  course: CourseWithMembers
  termLabel: string
  workspaceRole: Role
}

function CourseCard({
  assignmentCount,
  communityUnreadCount,
  course,
  termLabel,
  workspaceRole,
}: CourseCardProps) {
  const courseHomePath = `/${workspaceRole}/my-courses/${course.id}`
  const isStudent = workspaceRole === 'student'

  const actionIcons = (
    <>
      <span className="workspace-course-card-action">
        <CourseCardIcon name="announcement" />
        {assignmentCount > 0 && (
          <span className="workspace-course-card-badge">{Math.min(assignmentCount, 99)}</span>
        )}
      </span>
      {isStudent && (
        <Link
          aria-label={
            communityUnreadCount > 0
              ? `Community, ${communityUnreadCount} new updates`
              : 'Community'
          }
          className="workspace-course-card-action workspace-course-card-action--link"
          to={buildCourseDetailPath('student', course.id, 'community')}
        >
          <FontAwesomeIcon className="workspace-course-card-action-svg" icon={faPeopleRoof} />
          {communityUnreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="workspace-course-card-badge workspace-course-card-badge--notify"
            >
              {Math.min(communityUnreadCount, 99)}
            </span>
          ) : null}
        </Link>
      )}
      <span className="workspace-course-card-action">
        <CourseCardIcon name="edit" />
      </span>
    </>
  )

  if (isStudent) {
    return (
      <article className="workspace-course-card workspace-card--button">
        <Link
          aria-label={`Open ${courseLabel(course)}`}
          className="workspace-course-card-link workspace-card--link"
          to={courseHomePath}
        >
          <div className="workspace-course-card-visual" aria-hidden="true">
            <strong>{course.title}</strong>
            <span className="workspace-course-card-circle" />
            <span className="workspace-course-card-square" />
            <span className="workspace-course-card-menu">
              <span />
              <span />
              <span />
            </span>
          </div>

          <div className="workspace-course-card-body workspace-course-card-body--linked">
            <div className="workspace-course-card-copy">
              <h2>{course.code}</h2>
              <p className="workspace-course-card-title">{course.title}</p>
              <p className="workspace-course-card-term">{termLabel}</p>
            </div>
          </div>
        </Link>

        <div className="workspace-course-card-actions workspace-course-card-actions--footer">
          {actionIcons}
        </div>
      </article>
    )
  }

  return (
    <Link
      aria-label={`Open ${courseLabel(course)}`}
      className="workspace-course-card workspace-card--button workspace-card--link"
      to={courseHomePath}
    >
      <div className="workspace-course-card-visual" aria-hidden="true">
        <strong>{course.title}</strong>
        <span className="workspace-course-card-circle" />
        <span className="workspace-course-card-square" />
        <span className="workspace-course-card-menu">
          <span />
          <span />
          <span />
        </span>
      </div>

      <div className="workspace-course-card-body">
        <div className="workspace-course-card-copy">
          <h2>{course.code}</h2>
          <p className="workspace-course-card-title">{course.title}</p>
          <p className="workspace-course-card-term">{termLabel}</p>
        </div>

        <span className="workspace-course-card-actions" aria-hidden="true">
          {actionIcons}
        </span>
      </div>
    </Link>
  )
}

function MyCoursesPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const location = useLocation()
  const [courses, setCourses] = useState<CourseWithMembers[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [termFilter, setTermFilter] = useState<CourseTerm>('semester_1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTimestamp] = useState(() => Date.now())

  const loadData = useCallback(async () => {
    try {
      const [nextCourses, nextAssignments] = await Promise.all([
        fetchWorkspaceCourses(),
        fetchAssignments(),
      ])

      setCourses(nextCourses)
      setAssignments(nextAssignments)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Courses could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData, location.pathname])

  useEffect(() => {
    if (workspaceRole !== 'student') {
      return undefined
    }

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadData()
      }
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [loadData, workspaceRole])

  const assignmentsByCourse = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>()

    for (const assignment of assignments) {
      const current = map.get(assignment.course_id) ?? []
      current.push(assignment)
      map.set(assignment.course_id, current)
    }

    return map
  }, [assignments])
  const visibleCourses =
    workspaceRole === 'student'
      ? courses.filter((course) => course.term === termFilter)
      : courses
  const upcomingAssignments = assignments
    .filter((assignment) => new Date(assignment.due_at).getTime() >= currentTimestamp)
    .slice(0, 6)

  if (workspaceRole === 'admin') {
    return null
  }

  return (
    <section className="workspace-page workspace-course-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h3 className="workspace-page-title">
          {workspaceRole === 'teacher' ? 'Teaching courses' : 'My courses'}
        </h3>
        <p className="workspace-page-subtitle">
          {workspaceRole === 'teacher'
            ? 'Open an assigned course to manage modules, assignments, due dates, and submissions.'
            : 'Open an enrolled course to view modules, files, assignment requirements, and submission status.'}
        </p>
      </header>

      <WorkspaceAlertStack error={error} onDismissError={() => setError('')} />

      {loading ? (
        <section className="workspace-panel">Loading course workspace...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two workspace-my-courses-layout">
          <section className="workspace-grid">
            {workspaceRole === 'student' && (
              <div className="workspace-toolbar workspace-course-filter" aria-label="Term filter">
                {(['semester_1', 'semester_2', 'summer'] as CourseTerm[]).map((term) => (
                  <button
                    key={term}
                    type="button"
                    className={`workspace-tab workspace-course-filter-tab${
                      termFilter === term ? ' workspace-tab--active' : ''
                    }`}
                    onClick={() => setTermFilter(term)}
                  >
                    {termLabels[term]}
                  </button>
                ))}
              </div>
            )}

            <div className="workspace-course-card-grid">
              {visibleCourses.map((course) => {
                const courseAssignments = assignmentsByCourse.get(course.id) ?? []
                const termLabel = `${course.academic_year} HE ${termLabels[course.term]}`

                return (
                  <CourseCard
                    assignmentCount={courseAssignments.length}
                    communityUnreadCount={course.community_unread_count ?? 0}
                    course={course}
                    key={course.id}
                    termLabel={termLabel}
                    workspaceRole={workspaceRole}
                  />
                )
              })}
            </div>

            {visibleCourses.length === 0 && (
              <section className="workspace-panel">
                {workspaceRole === 'teacher'
                  ? 'No teaching courses found.'
                  : 'No courses found for this semester.'}
              </section>
            )}
          </section>

          <aside className="workspace-panel workspace-assignments-panel">
            <h2>Upcoming assignments</h2>
            <ul className="workspace-list">
              {upcomingAssignments.map((assignment) => {
                const course = courses.find((item) => item.id === assignment.course_id)

                return (
                  <li className="workspace-list-item" key={assignment.id}>
                    <strong>{assignment.title}</strong>
                    <span>
                      {course ? courseLabel(course) : 'Course'} - {toReadableDate(assignment.due_at)}
                    </span>
                  </li>
                )
              })}
            </ul>
            {upcomingAssignments.length === 0 && <p>No upcoming assignments.</p>}
          </aside>
        </div>
      )}
    </section>
  )
}

export default MyCoursesPage
