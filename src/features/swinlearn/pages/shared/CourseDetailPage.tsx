import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import {
  createAssignment,
  fetchCourseDetail,
  getErrorMessage,
  profileName,
  submitAssignment,
  updateAssignment,
} from '../../lib/workspace/api'
import type {
  AssignmentMutationInput,
  AssignmentRow,
  AssignmentSubmissionRow,
  CourseContentItemRow,
  CourseDetailData,
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

const itemTypeLabel: Record<CourseContentItemRow['item_type'], string> = {
  assignment: 'Assignment',
  attachment: 'File',
  quiz: 'Quiz',
  sub_header: 'Section',
  unknown: 'Item',
  wiki_page: 'Page',
}

const buildSubmissionsByAssignment = (submissions: AssignmentSubmissionRow[]) => {
  const map = new Map<string, AssignmentSubmissionRow[]>()

  for (const submission of submissions) {
    const current = map.get(submission.assignment_id) ?? []
    current.push(submission)
    map.set(submission.assignment_id, current)
  }

  return map
}

const buildProfilesById = (profiles: ProfileRow[]) => {
  const map = new Map<string, ProfileRow>()

  for (const profile of profiles) {
    map.set(profile.id, profile)
  }

  return map
}

function CourseDetailPage() {
  const { courseId = '' } = useParams()
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user } = useAuthContext()
  const [detail, setDetail] = useState<CourseDetailData | null>(null)
  const [activeContentItemId, setActiveContentItemId] = useState('')
  const [activeAssignmentId, setActiveAssignmentId] = useState('')
  const [assignmentForm, setAssignmentForm] = useState<AssignmentMutationInput>(defaultAssignmentForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    if (!courseId) {
      return
    }

    setLoading(true)

    try {
      const nextDetail = await fetchCourseDetail(courseId)
      const firstItem = nextDetail.contentPackage?.modules.flatMap((module) => module.items)[0]
      const firstAssignment = nextDetail.assignments[0]

      setDetail(nextDetail)
      setAssignmentForm((current) => ({
        ...current,
        course_id: current.course_id || nextDetail.course.id,
      }))
      setActiveContentItemId((current) => current || firstItem?.id || '')
      setActiveAssignmentId((current) => current || firstItem?.assignment_id || firstAssignment?.id || '')
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Course detail could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const allContentItems = useMemo(
    () => detail?.contentPackage?.modules.flatMap((module) => module.items) ?? [],
    [detail?.contentPackage?.modules],
  )
  const assignmentById = useMemo(() => {
    const map = new Map<string, AssignmentRow>()

    for (const assignment of detail?.assignments ?? []) {
      map.set(assignment.id, assignment)
    }

    return map
  }, [detail?.assignments])
  const profilesById = useMemo(
    () => buildProfilesById(detail?.profiles ?? []),
    [detail?.profiles],
  )
  const submissionsByAssignment = useMemo(
    () => buildSubmissionsByAssignment(detail?.submissions ?? []),
    [detail?.submissions],
  )
  const ownSubmissionByAssignment = useMemo(() => {
    const map = new Map<string, AssignmentSubmissionRow>()

    for (const submission of detail?.submissions ?? []) {
      if (submission.student_id === user?.id) {
        map.set(submission.assignment_id, submission)
      }
    }

    return map
  }, [detail?.submissions, user?.id])
  const contentItemByAssignmentId = useMemo(() => {
    const map = new Map<string, CourseContentItemRow>()

    for (const item of allContentItems) {
      if (item.assignment_id) {
        map.set(item.assignment_id, item)
      }
    }

    return map
  }, [allContentItems])
  const activeContentItem =
    allContentItems.find((item) => item.id === activeContentItemId) ?? allContentItems[0] ?? null
  const activeAssignment = activeAssignmentId
    ? assignmentById.get(activeAssignmentId) ?? null
    : activeContentItem?.assignment_id
      ? assignmentById.get(activeContentItem.assignment_id) ?? null
      : null

  const openContentItem = (item: CourseContentItemRow) => {
    setActiveContentItemId(item.id)
    if (item.assignment_id) {
      setActiveAssignmentId(item.assignment_id)
    }
  }

  const openAssignment = (assignmentId: string) => {
    const contentItem = contentItemByAssignmentId.get(assignmentId)

    setActiveAssignmentId(assignmentId)
    setActiveContentItemId(contentItem?.id ?? '')
  }

  const handleAssignmentCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !detail) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await createAssignment(
        {
          ...assignmentForm,
          course_id: detail.course.id,
          description: assignmentForm.description.trim(),
          due_at: new Date(assignmentForm.due_at).toISOString(),
          title: assignmentForm.title.trim(),
        },
        user.id,
      )

      setAssignmentForm(defaultAssignmentForm(detail.course.id))
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

  const renderAssignmentPanel = (assignment: AssignmentRow | null) => {
    if (!assignment) {
      return null
    }

    const assignmentSubmissions = submissionsByAssignment.get(assignment.id) ?? []
    const ownSubmission = ownSubmissionByAssignment.get(assignment.id)

    return (
      <section className="workspace-subpanel course-detail-assignment-panel">
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-chip">{assignment.status}</span>
            <h3>{assignment.title}</h3>
            <p>Due {toReadableDate(assignment.due_at)}</p>
          </div>
          {assignment.points_possible !== null && (
            <span className="workspace-chip">{assignment.points_possible} pts</span>
          )}
        </div>

        {assignment.submission_types && <p>Submission: {assignment.submission_types}</p>}

        {workspaceRole === 'teacher' ? (
          <>
            <div className="workspace-form workspace-form--inline">
              <label>
                <span>Due date</span>
                <input
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(assignment.due_at)}
                  onBlur={(event) => void handleDueDateChange(assignment.id, event.target.value)}
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
                    <span className="workspace-chip">{submission.file_paths.length} files</span>
                  </div>
                )
              })}

              {assignmentSubmissions.length === 0 && <p>No student submissions yet.</p>}
            </div>
          </>
        ) : (
          <>
            <span className="workspace-chip">
              {ownSubmission ? 'Submitted' : 'Not submitted'}
            </span>
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
          </>
        )}
      </section>
    )
  }

  if (workspaceRole === 'admin') {
    return null
  }

  if (loading) {
    return <section className="workspace-panel">Loading course detail...</section>
  }

  if (!detail) {
    return (
      <section className="workspace-page">
        {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      </section>
    )
  }

  return (
    <section className="workspace-page course-detail-page">
      <header className="workspace-page-header">
        <Link className="workspace-secondary-action course-detail-back" to={`/${workspaceRole}/my-courses`}>
          Back to courses
        </Link>
        <span className="workspace-eyebrow">{workspaceRole === 'teacher' ? 'Teaching course' : 'Course'}</span>
        <h1 className="workspace-page-title">{detail.course.title}</h1>
        <p className="workspace-page-subtitle">
          {detail.course.code} - {detail.course.description || 'No course description provided.'}
        </p>
        <div className="workspace-meta-row">
          <span className="workspace-chip">{detail.course.term.replace('_', ' ')}</span>
          <span className="workspace-chip">{detail.course.academic_year}</span>
          {detail.contentPackage && (
            <span className="workspace-chip">{detail.contentPackage.module_count} modules</span>
          )}
        </div>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      <div className="course-detail-layout">
        <aside className="workspace-panel course-detail-nav">
          <h2>Modules</h2>
          {detail.contentPackage ? (
            <div className="course-detail-module-list">
              {detail.contentPackage.modules.map((module) => (
                <section key={module.id}>
                  <h3>{module.title}</h3>
                  <div className="course-detail-item-list">
                    {module.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`course-detail-item${activeContentItem?.id === item.id ? ' course-detail-item--active' : ''}`}
                        style={{ marginLeft: `${item.indent * 14}px` }}
                        onClick={() => openContentItem(item)}
                      >
                        <span>{item.title}</span>
                        <small>{itemTypeLabel[item.item_type]}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="workspace-empty-state">No imported modules yet.</div>
          )}
        </aside>

        <main className="workspace-panel course-detail-main">
          {activeContentItem ? (
            <>
              <div className="workspace-section-heading">
                <div>
                  <span className="workspace-chip">{itemTypeLabel[activeContentItem.item_type]}</span>
                  <h2>{activeContentItem.title}</h2>
                </div>
              </div>
              {activeContentItem.content_html ? (
                <div
                  className="course-detail-rich-content"
                  dangerouslySetInnerHTML={{ __html: activeContentItem.content_html }}
                />
              ) : (
                <p>No content has been provided for this item.</p>
              )}
              {activeContentItem.asset && (
                <a className="workspace-primary-action course-detail-file-link" href={activeContentItem.asset.public_url}>
                  Open {activeContentItem.asset.title}
                </a>
              )}
              {renderAssignmentPanel(activeAssignment)}
            </>
          ) : activeAssignment ? (
            <>
              <h2>{activeAssignment.title}</h2>
              {activeAssignment.content_html ? (
                <div
                  className="course-detail-rich-content"
                  dangerouslySetInnerHTML={{ __html: activeAssignment.content_html }}
                />
              ) : (
                <p>{activeAssignment.description}</p>
              )}
              {renderAssignmentPanel(activeAssignment)}
            </>
          ) : (
            <div className="workspace-empty-state">Select a module item or assignment.</div>
          )}
        </main>

        <aside className="workspace-panel course-detail-side">
          <h2>Assignments</h2>
          <div className="course-detail-assignment-list">
            {detail.assignments.map((assignment) => {
              return (
                <button
                  key={assignment.id}
                  type="button"
                  className={`course-detail-assignment${activeAssignment?.id === assignment.id ? ' course-detail-assignment--active' : ''}`}
                  onClick={() => openAssignment(assignment.id)}
                >
                  <strong>{assignment.title}</strong>
                  <span>Due {toReadableDate(assignment.due_at)}</span>
                </button>
              )
            })}
            {detail.assignments.length === 0 && <p>No assignments published yet.</p>}
          </div>

          {workspaceRole === 'teacher' && (
            <section className="course-detail-create-assignment">
              <h2>Create assignment</h2>
              <form className="workspace-form" onSubmit={(event) => void handleAssignmentCreate(event)}>
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
                <button type="submit" disabled={saving}>
                  {saving ? 'Publishing...' : 'Publish assignment'}
                </button>
              </form>
            </section>
          )}

          {detail.contentPackage && detail.contentPackage.assets.length > 0 && (
            <section className="course-detail-resources">
              <h2>Files</h2>
              <ul className="workspace-list">
                {detail.contentPackage.assets.slice(0, 8).map((asset) => (
                  <li className="workspace-list-item" key={asset.id}>
                    <a href={asset.public_url}>{asset.title}</a>
                    {asset.size !== null && <span>{Math.round(asset.size / 1024)} KB</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}

export default CourseDetailPage
