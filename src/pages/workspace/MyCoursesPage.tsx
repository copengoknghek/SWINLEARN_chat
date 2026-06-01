import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import type { Role } from '../../hooks/useAuth'
import {
  courseLabel,
  createAssignment,
  fetchAssignments,
  fetchProfiles,
  fetchSubmissions,
  fetchWorkspaceCourses,
  getErrorMessage,
  profileName,
  submitAssignment,
  updateAssignment,
} from '../../lib/workspace/api'
import type {
  AssignmentMutationInput,
  AssignmentRow,
  AssignmentSubmissionRow,
  CourseSemester,
  CourseWithMembers,
  ProfileRow,
} from '../../lib/workspace/types'

const toDateTimeLocalValue = (isoValue: string) => {
  const date = new Date(isoValue)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

const toReadableDate = (isoValue: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoValue))

const defaultAssignmentForm = (courseId = ''): AssignmentMutationInput => ({
  course_id: courseId,
  title: '',
  description: '',
  due_at: toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
  status: 'published',
})

function MyCoursesPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user } = useAuthContext()
  const [courses, setCourses] = useState<CourseWithMembers[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [submissions, setSubmissions] = useState<AssignmentSubmissionRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [semesterFilter, setSemesterFilter] = useState<CourseSemester>('current')
  const [assignmentForm, setAssignmentForm] = useState<AssignmentMutationInput>(
    defaultAssignmentForm(),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [currentTimestamp] = useState(() => Date.now())

  const loadData = useCallback(async () => {
    try {
      const [nextCourses, nextAssignments, nextSubmissions, nextProfiles] = await Promise.all([
        fetchWorkspaceCourses(),
        fetchAssignments(),
        fetchSubmissions(),
        fetchProfiles(),
      ])

      setCourses(nextCourses)
      setAssignments(nextAssignments)
      setSubmissions(nextSubmissions)
      setProfiles(nextProfiles)
      setSelectedCourseId((current) => current || nextCourses[0]?.id || '')
      setAssignmentForm((current) => ({
        ...current,
        course_id: current.course_id || nextCourses[0]?.id || '',
      }))
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

  const profilesById = useMemo(() => {
    const map = new Map<string, ProfileRow>()

    for (const profile of profiles) {
      map.set(profile.id, profile)
    }

    return map
  }, [profiles])

  const visibleStudentCourses = courses.filter((course) => course.semester === semesterFilter)
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null
  const selectedCourseAssignments = assignments.filter(
    (assignment) => assignment.course_id === selectedCourse?.id,
  )
  const upcomingAssignments = assignments
    .filter((assignment) => new Date(assignment.due_at).getTime() >= currentTimestamp)
    .slice(0, 6)

  const submissionsByAssignment = useMemo(() => {
    const map = new Map<string, AssignmentSubmissionRow[]>()

    for (const submission of submissions) {
      const current = map.get(submission.assignment_id) ?? []
      current.push(submission)
      map.set(submission.assignment_id, current)
    }

    return map
  }, [submissions])

  const ownSubmissionsByAssignment = useMemo(() => {
    const map = new Map<string, AssignmentSubmissionRow>()

    for (const submission of submissions) {
      if (submission.student_id === user?.id) {
        map.set(submission.assignment_id, submission)
      }
    }

    return map
  }, [submissions, user?.id])

  const handleAssignmentCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await createAssignment(
        {
          ...assignmentForm,
          title: assignmentForm.title.trim(),
          description: assignmentForm.description.trim(),
          due_at: new Date(assignmentForm.due_at).toISOString(),
        },
        user.id,
      )

      setAssignmentForm(defaultAssignmentForm(assignmentForm.course_id))
      setNotice('Assignment published.')
      await loadData()
    } catch (createError) {
      setError(getErrorMessage(createError, 'Assignment could not be created'))
    } finally {
      setSaving(false)
    }
  }

  const handleDueDateChange = async (assignmentId: string, dueAt: string) => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await updateAssignment(assignmentId, {
        due_at: new Date(dueAt).toISOString(),
      })
      setNotice('Due date updated.')
      await loadData()
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Due date could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleStudentSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
    assignmentId: string,
  ) => {
    event.preventDefault()

    if (!user) {
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const body = String(formData.get('body') ?? '').trim()
    const fileInput = form.elements.namedItem('files') as HTMLInputElement | null

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await submitAssignment(assignmentId, user.id, body, fileInput?.files ?? null)
      form.reset()
      setNotice('Submission saved.')
      await loadData()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Submission could not be saved'))
    } finally {
      setSaving(false)
    }
  }

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
            ? 'Manage your assigned courses, publish assignments, update due dates, and review submissions.'
            : 'See enrolled courses for the semester, upcoming assignment deadlines, and submission status.'}
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      {loading ? (
        <section className="workspace-panel">Loading course workspace...</section>
      ) : workspaceRole === 'teacher' ? (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-grid">
            <div className="workspace-grid workspace-grid--three">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  className={`workspace-card workspace-card--button${selectedCourse?.id === course.id ? ' workspace-card--active' : ''}`}
                  onClick={() => {
                    setSelectedCourseId(course.id)
                    setAssignmentForm(defaultAssignmentForm(course.id))
                  }}
                >
                  <span className="workspace-chip">{course.code}</span>
                  <h2>{course.title}</h2>
                  <p>
                    {course.semester} {course.academic_year}
                  </p>
                </button>
              ))}
            </div>

            {selectedCourse && (
              <section className="workspace-panel">
                <div className="workspace-section-heading">
                  <div>
                    <h2>{courseLabel(selectedCourse)}</h2>
                    <p>{selectedCourse.description || 'No course description provided.'}</p>
                  </div>
                </div>

                <div className="workspace-grid">
                  {selectedCourseAssignments.map((assignment) => {
                    const assignmentSubmissions = submissionsByAssignment.get(assignment.id) ?? []

                    return (
                      <article className="workspace-card" key={assignment.id}>
                        <div className="workspace-section-heading">
                          <div>
                            <span className="workspace-chip">{assignment.status}</span>
                            <h2>{assignment.title}</h2>
                            <p>{assignment.description}</p>
                          </div>
                          <strong>{assignmentSubmissions.length} submissions</strong>
                        </div>

                        <div className="workspace-form workspace-form--inline">
                          <label>
                            <span>Due date</span>
                            <input
                              type="datetime-local"
                              defaultValue={toDateTimeLocalValue(assignment.due_at)}
                              onBlur={(event) =>
                                void handleDueDateChange(assignment.id, event.target.value)
                              }
                              disabled={saving}
                            />
                          </label>
                        </div>

                        <div className="workspace-submission-list">
                          {assignmentSubmissions.map((submission) => {
                            const student = profilesById.get(submission.student_id)

                            return (
                              <div className="workspace-submission" key={submission.id}>
                                <div>
                                  <strong>{profileName(student)}</strong>
                                  <span>{toReadableDate(submission.submitted_at)}</span>
                                  <p>{submission.body || 'No text response.'}</p>
                                </div>
                                <span className="workspace-chip">
                                  {submission.file_paths.length} files
                                </span>
                              </div>
                            )
                          })}

                          {assignmentSubmissions.length === 0 && (
                            <p>No student submissions yet.</p>
                          )}
                        </div>
                      </article>
                    )
                  })}

                  {selectedCourseAssignments.length === 0 && (
                    <div className="workspace-empty-state">No assignments yet.</div>
                  )}
                </div>
              </section>
            )}
          </section>

          <aside className="workspace-panel">
            <h2>Create assignment</h2>
            <form className="workspace-form" onSubmit={(event) => void handleAssignmentCreate(event)}>
              <label>
                <span>Course</span>
                <select
                  value={assignmentForm.course_id}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      course_id: event.target.value,
                    }))
                  }
                  required
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {courseLabel(course)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Title</span>
                <input
                  value={assignmentForm.title}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={assignmentForm.description}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="datetime-local"
                  value={assignmentForm.due_at}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, due_at: event.target.value }))
                  }
                  required
                />
              </label>
              <button type="submit" disabled={saving || courses.length === 0}>
                {saving ? 'Publishing...' : 'Publish assignment'}
              </button>
            </form>
          </aside>
        </div>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-grid">
            <div className="workspace-toolbar" aria-label="Semester filter">
              {(['previous', 'current', 'next'] as CourseSemester[]).map((semester) => (
                <button
                  key={semester}
                  type="button"
                  className={`workspace-tab${semesterFilter === semester ? ' workspace-tab--active' : ''}`}
                  onClick={() => setSemesterFilter(semester)}
                >
                  {semester === 'previous'
                    ? 'Last semester'
                    : semester === 'next'
                      ? 'Next semester'
                      : 'This semester'}
                </button>
              ))}
            </div>

            {visibleStudentCourses.map((course) => {
              const courseAssignments = assignments.filter(
                (assignment) => assignment.course_id === course.id,
              )

              return (
                <article className="workspace-card" key={course.id}>
                  <div className="workspace-section-heading">
                    <div>
                      <span className="workspace-chip">{course.code}</span>
                      <h2>{course.title}</h2>
                      <p>{course.description}</p>
                    </div>
                  </div>

                  <div className="workspace-grid">
                    {courseAssignments.map((assignment) => {
                      const ownSubmission = ownSubmissionsByAssignment.get(assignment.id)

                      return (
                        <section className="workspace-subpanel" key={assignment.id}>
                          <div className="workspace-section-heading">
                            <div>
                              <h3>{assignment.title}</h3>
                              <p>Due {toReadableDate(assignment.due_at)}</p>
                            </div>
                            <span className="workspace-chip">
                              {ownSubmission ? 'Submitted' : 'Not submitted'}
                            </span>
                          </div>
                          <p>{assignment.description}</p>
                          {ownSubmission && (
                            <p>
                              Submitted {toReadableDate(ownSubmission.submitted_at)} with{' '}
                              {ownSubmission.file_paths.length} files.
                            </p>
                          )}
                          <form
                            className="workspace-form"
                            onSubmit={(event) => void handleStudentSubmit(event, assignment.id)}
                          >
                            <label>
                              <span>Submission text</span>
                              <textarea name="body" placeholder="Write your response..." />
                            </label>
                            <label>
                              <span>Files</span>
                              <input name="files" type="file" multiple />
                            </label>
                            <button type="submit" disabled={saving}>
                              {ownSubmission ? 'Update submission' : 'Submit assignment'}
                            </button>
                          </form>
                        </section>
                      )
                    })}

                    {courseAssignments.length === 0 && <p>No assignments published yet.</p>}
                  </div>
                </article>
              )
            })}

            {visibleStudentCourses.length === 0 && (
              <section className="workspace-panel">No courses found for this semester.</section>
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
                      {course?.code ?? 'Course'} - {toReadableDate(assignment.due_at)}
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
