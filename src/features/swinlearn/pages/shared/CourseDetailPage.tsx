import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom'
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
  CourseTerm,
  ProfileRow,
} from '../../lib/workspace/types'
import {
  buildCourseDetailPath,
  courseDetailSectionLabels,
  courseDetailSections,
  isCourseDetailSection,
  scrollCourseContentIntoView,
  summarizeCourseDetail,
  type CourseDetailSection,
} from './courseDetailSections'

const termLabels: Record<CourseTerm, string> = {
  semester_1: 'Semester 1',
  semester_2: 'Semester 2',
  summer: 'Summer',
}

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

const formatTerm = (term: CourseTerm) => termLabels[term] ?? term.replace('_', ' ')

function CourseDetailPage() {
  const { courseId = '', section } = useParams()
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user } = useAuthContext()
  const activeSection: CourseDetailSection = isCourseDetailSection(section) ? section : 'home'
  const [detail, setDetail] = useState<CourseDetailData | null>(null)
  const [activeContentItemId, setActiveContentItemId] = useState('')
  const [activeAssignmentId, setActiveAssignmentId] = useState('')
  const [assignmentForm, setAssignmentForm] = useState<AssignmentMutationInput>(defaultAssignmentForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [currentTimestamp] = useState(() => Date.now())
  const coursePageRef = useRef<HTMLElement | null>(null)
  const moduleContentRef = useRef<HTMLElement | null>(null)

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
    if (!isCourseDetailSection(section)) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData, section])

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
      : detail?.assignments[0] ?? null
  const teacherMembers = useMemo(
    () =>
      detail?.course.members.filter(
        (member) => member.role === 'teacher' || member.role === 'teaching_assistant',
      ) ?? [],
    [detail?.course.members],
  )
  const courseSummary = useMemo(() => {
    if (!detail) {
      return null
    }

    return summarizeCourseDetail({
      assignments: detail.assignments,
      contentPackage: detail.contentPackage,
      currentTimestamp,
      memberCount: detail.course.members.length,
      teacherCount: teacherMembers.length,
    })
  }, [currentTimestamp, detail, teacherMembers.length])

  const openContentItem = (item: CourseContentItemRow) => {
    setActiveContentItemId(item.id)
    if (item.assignment_id) {
      setActiveAssignmentId(item.assignment_id)
    }
    scrollCourseContentIntoView(moduleContentRef.current)
  }

  const scrollModulesToTop = () => {
    scrollCourseContentIntoView(coursePageRef.current)
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

  const renderCourseHome = () => {
    if (!detail || !courseSummary) {
      return null
    }

    const teacherProfiles = teacherMembers
      .map((member) => profilesById.get(member.user_id))
      .filter((profile): profile is ProfileRow => profile !== undefined)

    return (
      <div className="workspace-grid workspace-grid--two course-detail-home-layout">
        <section className="workspace-panel course-detail-overview">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-chip">{detail.course.code}</span>
              <h2>Course home</h2>
            </div>
          </div>
          <p>{detail.course.description || 'No course description provided.'}</p>

          <div className="course-detail-stat-grid" aria-label="Course summary">
            <article className="course-detail-stat">
              <strong>{courseSummary.moduleCount}</strong>
              <span>Modules</span>
            </article>
            <article className="course-detail-stat">
              <strong>{courseSummary.assignmentCount}</strong>
              <span>Assignments</span>
            </article>
            <article className="course-detail-stat">
              <strong>{courseSummary.fileCount}</strong>
              <span>Files</span>
            </article>
            <article className="course-detail-stat">
              <strong>{courseSummary.memberCount}</strong>
              <span>Members</span>
            </article>
          </div>

          {detail.contentPackage ? (
            <div className="workspace-subpanel">
              <h3>{detail.contentPackage.source_title}</h3>
              <p>
                Imported from {detail.contentPackage.original_file_name || 'course ZIP'} with{' '}
                {detail.contentPackage.module_count} modules and {detail.contentPackage.item_count}{' '}
                learning items.
              </p>
            </div>
          ) : (
            <div className="workspace-empty-state">
              No imported course package yet. Modules, files, and imported assignment pages will
              appear after an admin imports a Canvas ZIP.
            </div>
          )}
        </section>

        <aside className="workspace-grid course-detail-home-side">
          <section className="workspace-panel">
            <h2>Teaching team</h2>
            <ul className="workspace-list">
              {teacherProfiles.map((profile) => (
                <li className="workspace-list-item" key={profile.id}>
                  <strong>{profileName(profile)}</strong>
                  <span>{profile.email}</span>
                </li>
              ))}
            </ul>
            {teacherProfiles.length === 0 && (
              <p>{courseSummary.teacherCount} teaching staff assigned.</p>
            )}
          </section>

          <section className="workspace-panel">
            <h2>Upcoming assignment</h2>
            {courseSummary.upcomingAssignment ? (
              <div className="workspace-list-item">
                <strong>{courseSummary.upcomingAssignment.title}</strong>
                <span>Due {toReadableDate(courseSummary.upcomingAssignment.due_at)}</span>
              </div>
            ) : (
              <p>No upcoming assignment.</p>
            )}
          </section>
        </aside>
      </div>
    )
  }

  const renderModulesSection = () => {
    if (!detail?.contentPackage) {
      return <div className="workspace-empty-state">No imported modules yet.</div>
    }

    return (
      <div className="course-detail-layout course-detail-layout--modules">
        <aside className="workspace-panel course-detail-nav">
          <h2>Modules</h2>
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
        </aside>

        <main className="workspace-panel course-detail-main" ref={moduleContentRef}>
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
            </>
          ) : (
            <div className="workspace-empty-state">Select a module item.</div>
          )}
        </main>
        <button
          type="button"
          className="course-detail-scroll-top"
          aria-label="Scroll course page to top"
          onClick={scrollModulesToTop}
        >
          &uarr;
        </button>
      </div>
    )
  }

  const renderAssignmentsSection = () => (
    <div className="course-detail-layout course-detail-layout--assignments">
      <aside className="workspace-panel course-detail-side">
        <h2>Assignment</h2>
        <div className="course-detail-assignment-list">
          {detail?.assignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              className={`course-detail-assignment${activeAssignment?.id === assignment.id ? ' course-detail-assignment--active' : ''}`}
              onClick={() => openAssignment(assignment.id)}
            >
              <strong>{assignment.title}</strong>
              <span>Due {toReadableDate(assignment.due_at)}</span>
            </button>
          ))}
          {detail?.assignments.length === 0 && <p>No assignments published yet.</p>}
        </div>

        {workspaceRole === 'teacher' && detail && (
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
      </aside>

      <main className="workspace-panel course-detail-main">
        {activeAssignment ? (
          <>
            <div className="workspace-section-heading">
              <div>
                <span className="workspace-chip">Assignment</span>
                <h2>{activeAssignment.title}</h2>
              </div>
            </div>
            {activeAssignment.content_html ? (
              <div
                className="course-detail-rich-content"
                dangerouslySetInnerHTML={{ __html: activeAssignment.content_html }}
              />
            ) : (
              <p>{activeAssignment.description || 'No assignment content has been provided.'}</p>
            )}
            {renderAssignmentPanel(activeAssignment)}
          </>
        ) : (
          <div className="workspace-empty-state">Select an assignment.</div>
        )}
      </main>
    </div>
  )

  const renderGradesSection = () => (
    <section className="workspace-panel course-detail-grades-panel">
      <div className="workspace-section-heading">
        <div>
          <span className="workspace-chip">Read only</span>
          <h2>Grades</h2>
          <p>Scores are not stored yet, so this page shows submission status and available points.</p>
        </div>
      </div>

      <div className="workspace-table workspace-table--spaced course-detail-grade-table">
        {detail?.assignments.map((assignment) => {
          const ownSubmission = ownSubmissionByAssignment.get(assignment.id)
          const assignmentSubmissions = submissionsByAssignment.get(assignment.id) ?? []
          const status =
            workspaceRole === 'teacher'
              ? `${assignmentSubmissions.length} submissions`
              : ownSubmission
                ? `Submitted ${toReadableDate(ownSubmission.submitted_at)}`
                : 'Not submitted'

          return (
            <div className="workspace-row course-detail-grade-row" key={assignment.id}>
              <div>
                <strong>{assignment.title}</strong>
                <small>{status}</small>
              </div>
              <span>{assignment.points_possible ?? '-'} pts</span>
              <span>Not graded yet</span>
            </div>
          )
        })}
      </div>

      {detail?.assignments.length === 0 && (
        <div className="workspace-empty-state">No assignments available for grades.</div>
      )}
    </section>
  )

  const renderActiveSection = () => {
    if (activeSection === 'home') {
      return renderCourseHome()
    }

    if (activeSection === 'modules') {
      return renderModulesSection()
    }

    if (activeSection === 'assignments') {
      return renderAssignmentsSection()
    }

    return renderGradesSection()
  }

  if (workspaceRole === 'admin') {
    return null
  }

  if (!isCourseDetailSection(section)) {
    return <Navigate to={buildCourseDetailPath(workspaceRole, courseId, 'home')} replace />
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
    <section className="workspace-page course-detail-page" ref={coursePageRef}>
      <header className="workspace-page-header course-detail-header">
        <Link className="workspace-secondary-action course-detail-back" to={`/${workspaceRole}/my-courses`}>
          &lt; Back to courses
        </Link>
        <span className="workspace-eyebrow">{workspaceRole === 'teacher' ? 'Teaching course' : 'Course'}</span>
        <h1 className="workspace-page-title">{detail.course.title}</h1>
        <p className="workspace-page-subtitle">
          {detail.course.code} - {detail.course.description || 'No course description provided.'}
        </p>
        <div className="workspace-meta-row">
          <span className="workspace-chip">{formatTerm(detail.course.term)}</span>
          <span className="workspace-chip">{detail.course.academic_year}</span>
          {detail.contentPackage && (
            <span className="workspace-chip">{detail.contentPackage.module_count} modules</span>
          )}
        </div>

        <nav className="course-detail-child-nav" aria-label="Course sections">
          {courseDetailSections.map((courseSection) => (
            <Link
              key={courseSection}
              className={`course-detail-child-nav-link${
                activeSection === courseSection ? ' course-detail-child-nav-link--active' : ''
              }`}
              to={buildCourseDetailPath(workspaceRole, detail.course.id, courseSection)}
            >
              {courseDetailSectionLabels[courseSection]}
            </Link>
          ))}
        </nav>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      {renderActiveSection()}
    </section>
  )
}

export default CourseDetailPage
