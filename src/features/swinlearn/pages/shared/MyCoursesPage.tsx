import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { Role } from '../../../../hooks/useAuth'
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

function MyCoursesPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
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
  }, [loadData])

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
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">
          {workspaceRole === 'teacher' ? 'Teaching courses' : 'My courses'}
        </h1>
        <p className="workspace-page-subtitle">
          {workspaceRole === 'teacher'
            ? 'Open an assigned course to manage modules, assignments, due dates, and submissions.'
            : 'Open an enrolled course to view modules, files, assignment requirements, and submission status.'}
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}

      {loading ? (
        <section className="workspace-panel">Loading course workspace...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-grid">
            {workspaceRole === 'student' && (
              <div className="workspace-toolbar" aria-label="Term filter">
                {(['semester_1', 'semester_2', 'summer'] as CourseTerm[]).map((term) => (
                  <button
                    key={term}
                    type="button"
                    className={`workspace-tab${termFilter === term ? ' workspace-tab--active' : ''}`}
                    onClick={() => setTermFilter(term)}
                  >
                    {termLabels[term]}
                  </button>
                ))}
              </div>
            )}

            <div className="workspace-grid workspace-grid--three">
              {visibleCourses.map((course) => {
                const courseAssignments = assignmentsByCourse.get(course.id) ?? []
                const nextAssignment = courseAssignments.find(
                  (assignment) => new Date(assignment.due_at).getTime() >= currentTimestamp,
                )

                return (
                  <Link
                    className="workspace-card workspace-card--button workspace-card--link"
                    key={course.id}
                    to={`/${workspaceRole}/my-courses/${course.id}`}
                  >
                    <div className="workspace-section-heading">
                      <div>
                        <span className="workspace-chip">{course.code}</span>
                        <h2>{course.title}</h2>
                        <p>{course.description || 'No course description provided.'}</p>
                      </div>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-chip">
                        {termLabels[course.term]} {course.academic_year}
                      </span>
                      <span className="workspace-chip">
                        {courseAssignments.length} assignments
                      </span>
                    </div>
                    {nextAssignment && (
                      <p>
                        Next due: {nextAssignment.title} on {toReadableDate(nextAssignment.due_at)}
                      </p>
                    )}
                  </Link>
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

          <aside className="workspace-panel">
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
