import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Role } from '../../hooks/useAuth'
import {
  courseLabel,
  fetchAssignments,
  fetchCalendarSessions,
  fetchWorkspaceCourses,
  getErrorMessage,
} from '../../lib/workspace/api'
import type {
  AssignmentRow,
  CourseSessionRow,
  CourseWithMembers,
} from '../../lib/workspace/types'

type CalendarItem = {
  id: string
  date: Date
  title: string
  detail: string
  type: 'class' | 'deadline' | 'event'
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

function WorkspaceCalendarPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const [courses, setCourses] = useState<CourseWithMembers[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [sessions, setSessions] = useState<CourseSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCalendar = useCallback(async () => {
    try {
      const [nextCourses, nextAssignments, nextSessions] = await Promise.all([
        fetchWorkspaceCourses(),
        fetchAssignments(),
        fetchCalendarSessions(),
      ])

      setCourses(nextCourses)
      setAssignments(nextAssignments)
      setSessions(nextSessions)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Calendar could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadCalendar(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCalendar])

  const courseById = useMemo(() => {
    const map = new Map<string, CourseWithMembers>()

    for (const course of courses) {
      map.set(course.id, course)
    }

    return map
  }, [courses])

  const items = useMemo<CalendarItem[]>(() => {
    const sessionItems = sessions.map((session) => {
      const course = courseById.get(session.course_id)
      const startDate = new Date(session.starts_at)
      const endDate = new Date(session.ends_at)

      return {
        id: session.id,
        date: startDate,
        title: session.title,
        detail: `${course ? courseLabel(course) : 'Course'} - ${formatTime(startDate)} to ${formatTime(endDate)}${session.location ? ` at ${session.location}` : ''}`,
        type: session.session_type === 'event' ? 'event' : 'class',
      } satisfies CalendarItem
    })

    const assignmentItems =
      workspaceRole === 'student'
        ? assignments.map((assignment) => {
            const course = courseById.get(assignment.course_id)
            const dueDate = new Date(assignment.due_at)

            return {
              id: assignment.id,
              date: dueDate,
              title: assignment.title,
              detail: `${course?.code ?? 'Course'} deadline at ${formatTime(dueDate)}`,
              type: 'deadline',
            } satisfies CalendarItem
          })
        : []

    return [...sessionItems, ...assignmentItems].sort(
      (first, second) => first.date.getTime() - second.date.getTime(),
    )
  }, [assignments, courseById, sessions, workspaceRole])

  const groupedItems = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()

    for (const item of items) {
      const key = item.date.toISOString().slice(0, 10)
      const current = map.get(key) ?? []
      current.push(item)
      map.set(key, current)
    }

    return Array.from(map.entries()).slice(0, 14)
  }, [items])

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">Calendar</h1>
        <p className="workspace-page-subtitle">
          {workspaceRole === 'teacher'
            ? 'See teaching days and class sessions for your assigned courses.'
            : 'Track class sessions, events, and assignment deadlines for your enrolled courses.'}
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}

      {loading ? (
        <section className="workspace-panel">Loading calendar...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-panel">
            <h2>{workspaceRole === 'teacher' ? 'Teaching schedule' : 'Upcoming schedule'}</h2>
            <div className="calendar-workspace-grid calendar-workspace-grid--list">
              {groupedItems.map(([dateKey, dayItems]) => (
                <div className="calendar-workspace-cell" key={dateKey}>
                  <strong>{formatDate(new Date(`${dateKey}T00:00:00`))}</strong>
                  {dayItems.map((item) => (
                    <span
                      className={`calendar-workspace-event calendar-workspace-event--${item.type}`}
                      key={item.id}
                    >
                      {item.title}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {groupedItems.length === 0 && <p>No calendar items yet.</p>}
          </section>

          <aside className="workspace-panel">
            <h2>Agenda</h2>
            <ul className="workspace-list">
              {items.slice(0, 8).map((item) => (
                <li className="workspace-list-item" key={`${item.type}-${item.id}`}>
                  <strong>
                    {formatDate(item.date)} - {item.title}
                  </strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
            {items.length === 0 && <p>No classes or deadlines are scheduled.</p>}
          </aside>
        </div>
      )}
    </section>
  )
}

export default WorkspaceCalendarPage
