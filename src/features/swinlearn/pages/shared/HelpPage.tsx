import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Role } from '../../../../hooks/useAuth'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import {
  CONSULTATION_TOPIC,
  fetchConsultationTeachers,
  fetchHelpRequests,
  getErrorMessage,
  helpRequestStatusLabel,
  helpTopicLabel,
  helpTopicPresets,
  profileName,
  submitHelpRequest,
} from '../../lib/workspace/api'
import type { ConsultationTeacherRow, HelpRequestRow } from '../../lib/workspace/types'

const helpTopics = [
  {
    title: 'Course access',
    description: 'Get help when a unit, assessment, or learning resource is missing.',
  },
  {
    title: 'Technical support',
    description: 'Report login, browser, file upload, or platform errors.',
  },
  {
    title: 'Study support',
    description: 'Find workshops, tutoring, and student service guidance.',
  },
]

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))

const teacherName = (teacher: ConsultationTeacherRow) =>
  teacher.display_name || teacher.full_name || teacher.email

const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

const toDateString = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

function HelpPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const [topicPreset, setTopicPreset] = useState('course-access')
  const [customTopic, setCustomTopic] = useState('')
  const [details, setDetails] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [consultationTime, setConsultationTime] = useState('10:00')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [teachers, setTeachers] = useState<ConsultationTeacherRow[]>([])
  const [requests, setRequests] = useState<HelpRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isConsultation = topicPreset === CONSULTATION_TOPIC
  const resolvedTopic = topicPreset === 'custom' ? customTopic.trim() : topicPreset

  const loadPage = useCallback(async () => {
    try {
      const [nextRequests, nextTeachers] = await Promise.all([
        fetchHelpRequests(),
        workspaceRole === 'student' ? fetchConsultationTeachers() : Promise.resolve([]),
      ])

      setRequests(nextRequests)
      setTeachers(nextTeachers)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Help page could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [workspaceRole])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadPage(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadPage])

  const recommendedTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.recommended),
    [teachers],
  )

  const otherTeachers = useMemo(
    () => teachers.filter((teacher) => !teacher.recommended),
    [teachers],
  )

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(calendarMonth.year, calendarMonth.month, 1).getDay()
    const totalDays = daysInMonth(calendarMonth.year, calendarMonth.month)
    const cells: Array<number | null> = []

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(day)
    }

    return cells
  }, [calendarMonth])

  const selectedDateString =
    selectedDay === null
      ? ''
      : toDateString(calendarMonth.year, calendarMonth.month, selectedDay)

  const shiftMonth = (delta: number) => {
    setCalendarMonth((current) => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
    setSelectedDay(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      if (!resolvedTopic) {
        throw new Error('Topic is required.')
      }

      if (isConsultation) {
        if (!teacherId) {
          throw new Error('Select a teacher for your consultation.')
        }

        if (!selectedDateString) {
          throw new Error('Select a consultation day on the calendar.')
        }
      }

      await submitHelpRequest({
        topic: resolvedTopic,
        details,
        teacher_id: isConsultation ? teacherId : undefined,
        consultation_date: isConsultation ? selectedDateString : undefined,
        consultation_time: isConsultation ? consultationTime : undefined,
      })

      setDetails('')
      setCustomTopic('')
      setTeacherId('')
      setSelectedDay(null)
      setTopicPreset('course-access')
      setNotice('Your help request was submitted.')
      await loadPage()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Help request could not be submitted'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">Help</h1>
        <p className="workspace-page-subtitle">
          Start a support request or find the right team for coursework, platform, and account
          questions.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      <div className="workspace-grid workspace-grid--three">
        {helpTopics.map((topic) => (
          <article className="workspace-card" key={topic.title}>
            <h2>{topic.title}</h2>
            <p>{topic.description}</p>
          </article>
        ))}
      </div>

      <section className="workspace-panel">
        <h2>Submit a help request</h2>
        <form className="workspace-form help-request-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            <span>Topic</span>
            <select
              value={topicPreset}
              onChange={(event) => setTopicPreset(event.target.value)}
            >
              {helpTopicPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Other (type below)</option>
            </select>
          </label>

          {(topicPreset === 'custom') && (
            <label>
              <span>Custom topic</span>
              <input
                type="text"
                value={customTopic}
                onChange={(event) => setCustomTopic(event.target.value)}
                placeholder="Describe your topic"
              />
            </label>
          )}

          {isConsultation && workspaceRole === 'student' && (
            <div className="help-consultation-fields">
              <label>
                <span>Teacher</span>
                <select
                  value={teacherId}
                  onChange={(event) => setTeacherId(event.target.value)}
                  required
                >
                  <option value="">Select a teacher</option>
                  {recommendedTeachers.length > 0 && (
                    <optgroup label="Recommended">
                      {recommendedTeachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacherName(teacher)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All teachers">
                    {otherTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacherName(teacher)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <div className="help-mini-calendar">
                <div className="help-mini-calendar-header">
                  <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    ‹
                  </button>
                  <strong>{monthLabel(calendarMonth.year, calendarMonth.month)}</strong>
                  <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
                    ›
                  </button>
                </div>
                <div className="help-mini-calendar-weekdays" aria-hidden="true">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>
                <div className="help-mini-calendar-grid">
                  {calendarCells.map((day, index) =>
                    day === null ? (
                      <span key={`empty-${index}`} className="help-mini-calendar-empty" />
                    ) : (
                      <button
                        key={day}
                        type="button"
                        className={
                          selectedDay === day
                            ? 'help-mini-calendar-day is-selected'
                            : 'help-mini-calendar-day'
                        }
                        onClick={() => setSelectedDay(day)}
                      >
                        {day}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <label>
                <span>Time</span>
                <input
                  type="time"
                  value={consultationTime}
                  onChange={(event) => setConsultationTime(event.target.value)}
                  required
                />
              </label>
            </div>
          )}

          <label>
            <span>Details</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Tell us what happened and what you need."
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Create request'}
          </button>
        </form>
      </section>

      <section className="workspace-panel">
        <h2>My requests</h2>
        {loading && <p>Loading requests…</p>}
        {!loading && requests.length === 0 && (
          <p className="workspace-muted">You have not submitted any help requests yet.</p>
        )}
        {!loading && requests.length > 0 && (
          <div className="workspace-list help-request-list">
            {requests.map((request) => (
              <article className="workspace-card help-request-card" key={request.id}>
                <div className="help-request-card-header">
                  <h3>{helpTopicLabel(request.topic)}</h3>
                  <span className={`help-request-status help-request-status--${request.status}`}>
                    {helpRequestStatusLabel[request.status]}
                  </span>
                </div>
                <p>{request.details || 'No additional details provided.'}</p>
                <dl className="help-request-meta">
                  <div>
                    <dt>Type</dt>
                    <dd>{request.type === 'consultation' ? 'Consultation' : 'General help'}</dd>
                  </div>
                  {request.teacher && (
                    <div>
                      <dt>Teacher</dt>
                      <dd>{profileName(request.teacher)}</dd>
                    </div>
                  )}
                  {request.requested_starts_at && (
                    <div>
                      <dt>Requested time</dt>
                      <dd>
                        {formatDate(request.requested_starts_at)} at{' '}
                        {formatTime(request.requested_starts_at)}
                      </dd>
                    </div>
                  )}
                  {request.room_name && (
                    <div>
                      <dt>Room</dt>
                      <dd>{request.room_name}</dd>
                    </div>
                  )}
                  {request.created_at && (
                    <div>
                      <dt>Submitted</dt>
                      <dd>{formatDate(request.created_at)}</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default HelpPage
