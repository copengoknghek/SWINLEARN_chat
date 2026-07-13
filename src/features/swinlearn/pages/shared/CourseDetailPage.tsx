import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import {
  createAssignment,
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunity,
  fetchCourseDetail,
  getErrorMessage,
  indexSwinlearnCourses,
  markCommunityRead,
  profileName,
  submitAssignment,
  toggleCommunityLike,
  updateAssignment,
} from '../../lib/workspace/api'
import type {
  AssignmentMutationInput,
  AssignmentRow,
  AssignmentSubmissionRow,
  CommunityPostRow,
  CommunityImageRow,
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
import CommunityCommentThread from './CommunityCommentThread'
import { CommunityAuthorHeader } from '../../components/CommunityAuthorHeader'
import { CommunityConfirmDialog } from '../../components/CommunityConfirmDialog'
import { CommunityShareModal } from '../../components/CommunityShareModal'
import { CommunityVoteButton } from '../../components/CommunityVoteButton'
import { SwinlearnKnowledgeIndexPanel } from '../../components/SwinlearnKnowledgeIndexPanel'

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

const submissionIndexLabel = (submission: AssignmentSubmissionRow) => {
  switch (submission.index_status) {
    case 'ready':
      return 'Ready for Swinlearn'
    case 'error':
      return submission.index_error || 'Could not index submission'
    case 'skipped':
      return 'No readable content for Swinlearn'
    case 'pending':
      return 'Indexing...'
    default:
      return null
  }
}

const submissionFileUrl = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/')

  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

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

const communityMaxImagesPerPost = 4
const workspaceAlertDismissMs = 5000

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
  const [modulesCollapsed, setModulesCollapsed] = useState(false)
  const [communityPosts, setCommunityPosts] = useState<CommunityPostRow[]>([])
  const [communityViewerGold, setCommunityViewerGold] = useState(0)
  const [communityLoading, setCommunityLoading] = useState(false)
  const [newPostBody, setNewPostBody] = useState('')
  const [pendingPostImages, setPendingPostImages] = useState<File[]>([])
  const [isCommunityPostComposerOpen, setCommunityPostComposerOpen] = useState(false)
  const [openCommunityCommentPostIds, setOpenCommunityCommentPostIds] = useState<Record<string, boolean>>({})
  const [sharePost, setSharePost] = useState<CommunityPostRow | null>(null)
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null)
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null)
  const [communityImagePreview, setCommunityImagePreview] = useState<{
    images: CommunityImageRow[]
    index: number
  } | null>(null)
  const coursePageRef = useRef<HTMLElement | null>(null)
  const moduleContentRef = useRef<HTMLElement | null>(null)
  const communityReadMarkedRef = useRef<string | null>(null)

  useEffect(() => {
    communityReadMarkedRef.current = null
  }, [courseId])

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

  const loadCommunity = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!courseId) {
      return
    }

    if (!silent) {
      setCommunityLoading(true)
    }

    try {
      const data = await fetchCommunity(courseId)
      setCommunityPosts(data.posts)
      setCommunityViewerGold(data.viewer?.gold_balance ?? 0)

      if (workspaceRole === 'student' && communityReadMarkedRef.current !== courseId) {
        communityReadMarkedRef.current = courseId
        void markCommunityRead(courseId).catch(() => {})
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Community could not be loaded'))
    } finally {
      if (!silent) {
        setCommunityLoading(false)
      }
    }
  }, [courseId, workspaceRole])

  useEffect(() => {
    if (!isCourseDetailSection(section)) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData, section])

  useEffect(() => {
    if (activeSection !== 'community' || !courseId) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => void loadCommunity(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeSection, courseId, loadCommunity])

  useEffect(() => {
    if (error === '' && notice === '') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setError('')
      setNotice('')
    }, workspaceAlertDismissMs)

    return () => window.clearTimeout(timeoutId)
  }, [error, notice])

  useEffect(() => {
    if (activeSection !== 'community' || communityLoading || communityPosts.length === 0) {
      return undefined
    }

    const hash = window.location.hash.replace(/^#/, '')

    if (!hash.startsWith('post-')) {
      return undefined
    }

    const postId = hash.slice('post-'.length)
    const target = document.getElementById(`community-post-${postId}`)

    if (!target) {
      return undefined
    }

    const scrollTimeoutId = window.setTimeout(() => {
      setOpenCommunityCommentPostIds((current) => ({ ...current, [postId]: true }))
      setHighlightPostId(postId)
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)

    const highlightTimeoutId = window.setTimeout(() => setHighlightPostId(null), 2000)

    return () => {
      window.clearTimeout(scrollTimeoutId)
      window.clearTimeout(highlightTimeoutId)
    }
  }, [activeSection, communityLoading, communityPosts.length])

  const pendingImagePreviews = useMemo(
    () => pendingPostImages.map((file) => URL.createObjectURL(file)),
    [pendingPostImages],
  )

  useEffect(
    () => () => {
      for (const preview of pendingImagePreviews) {
        URL.revokeObjectURL(preview)
      }
    },
    [pendingImagePreviews],
  )

  useEffect(() => {
    if (!communityImagePreview) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCommunityImagePreview(null)
        return
      }

      if (communityImagePreview.images.length < 2) {
        return
      }

      if (event.key === 'ArrowLeft') {
        setCommunityImagePreview((current) => {
          if (!current) {
            return current
          }

          const nextIndex =
            (current.index - 1 + current.images.length) % current.images.length

          return { ...current, index: nextIndex }
        })
      }

      if (event.key === 'ArrowRight') {
        setCommunityImagePreview((current) => {
          if (!current) {
            return current
          }

          const nextIndex = (current.index + 1) % current.images.length

          return { ...current, index: nextIndex }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [communityImagePreview])

  const openCommunityImagePreview = (images: CommunityImageRow[], index: number) => {
    setCommunityImagePreview({ images, index })
  }

  const shiftCommunityImagePreview = (direction: -1 | 1) => {
    setCommunityImagePreview((current) => {
      if (!current || current.images.length < 2) {
        return current
      }

      const nextIndex =
        (current.index + direction + current.images.length) % current.images.length

      return { ...current, index: nextIndex }
    })
  }

  const renderCommunityImageLightbox = () => {
    if (!communityImagePreview) {
      return null
    }

    const currentImage = communityImagePreview.images[communityImagePreview.index]
    const hasMultiple = communityImagePreview.images.length > 1

    return (
      <div
        className="course-detail-community-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        onClick={() => setCommunityImagePreview(null)}
      >
        <button
          type="button"
          className="course-detail-community-lightbox-close"
          aria-label="Close image preview"
          onClick={() => setCommunityImagePreview(null)}
        >
          &times;
        </button>

        {hasMultiple && (
          <button
            type="button"
            className="course-detail-community-lightbox-nav course-detail-community-lightbox-nav--prev"
            aria-label="Previous image"
            onClick={(event) => {
              event.stopPropagation()
              shiftCommunityImagePreview(-1)
            }}
          >
            &lsaquo;
          </button>
        )}

        <figure
          className="course-detail-community-lightbox-frame"
          onClick={(event) => event.stopPropagation()}
        >
          <img src={currentImage.public_url} alt={currentImage.original_name} />
          {hasMultiple && (
            <figcaption>
              {communityImagePreview.index + 1} / {communityImagePreview.images.length}
            </figcaption>
          )}
        </figure>

        {hasMultiple && (
          <button
            type="button"
            className="course-detail-community-lightbox-nav course-detail-community-lightbox-nav--next"
            aria-label="Next image"
            onClick={(event) => {
              event.stopPropagation()
              shiftCommunityImagePreview(1)
            }}
          >
            &rsaquo;
          </button>
        )}
      </div>
    )
  }

  const addPendingPostImages = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      return
    }

    setPendingPostImages((current) => [...current, ...imageFiles].slice(0, communityMaxImagesPerPost))
  }

  const removePendingPostImage = (index: number) => {
    setPendingPostImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleCommunityPostPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (imageFiles.length === 0) {
      return
    }

    event.preventDefault()
    addPendingPostImages(imageFiles)
  }

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
      setNotice('Assignment published. Re-index SWINLEARN knowledge so chatbot answers stay current.')
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
      setNotice('Due date updated. Re-index SWINLEARN knowledge so chatbot answers stay current.')
      await loadData()
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Due date could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleIndexKnowledge = async () => {
    if (!detail) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await indexSwinlearnCourses([detail.course.id])
      setNotice('Course knowledge indexed for SWINLEARN retrieval.')
      await loadData()
    } catch (indexError) {
      setError(getErrorMessage(indexError, 'Course knowledge could not be indexed'))
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

  const handleCommunityPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!courseId || (!newPostBody.trim() && pendingPostImages.length === 0)) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await createCommunityPost(courseId, newPostBody.trim(), pendingPostImages)
      setNewPostBody('')
      setPendingPostImages([])
      setCommunityPostComposerOpen(false)
      setNotice('Post published.')
      await loadCommunity({ silent: true })
    } catch (postError) {
      setError(getErrorMessage(postError, 'Post could not be published'))
    } finally {
      setSaving(false)
    }
  }

  const toggleCommunityComments = (postId: string) => {
    setOpenCommunityCommentPostIds((current) => ({
      ...current,
      [postId]: !current[postId],
    }))
  }

  const handleCommunityLike = async (postId: string) => {
    if (!courseId) {
      return
    }

    try {
      const result = await toggleCommunityLike(courseId, postId)
      setCommunityPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, liked_by_me: result.liked, like_count: result.like_count }
            : post,
        ),
      )
    } catch (likeError) {
      setError(getErrorMessage(likeError, 'Like could not be updated'))
    }
  }

  const handleDeleteCommunityPost = async () => {
    if (!pendingDeletePostId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await deleteCommunityPost(pendingDeletePostId)
      setPendingDeletePostId(null)
      setNotice('Post deleted.')
      await loadCommunity({ silent: true })
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Post could not be deleted'))
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
                    <div className="workspace-chip-row">
                      <span className="workspace-chip">{submission.file_paths.length} files</span>
                      {submission.github_url && (
                        <span className="workspace-chip">GitHub linked</span>
                      )}
                    </div>
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
              <>
                <p>
                  Submitted {toReadableDate(ownSubmission.submitted_at)} with{' '}
                  {ownSubmission.file_paths.length} files.
                </p>
                {submissionIndexLabel(ownSubmission) && (
                  <p className="workspace-muted">{submissionIndexLabel(ownSubmission)}</p>
                )}
                <section className="workspace-subpanel workspace-submission-review">
                  <h4>Your submitted work</h4>
                  <p>{ownSubmission.body || 'No submission text provided.'}</p>
                  {ownSubmission.github_url && (
                    <p>
                      GitHub:{' '}
                      <a href={ownSubmission.github_url} rel="noreferrer" target="_blank">
                        {ownSubmission.github_url}
                      </a>
                    </p>
                  )}
                  {ownSubmission.file_paths.length > 0 && (
                    <ul className="workspace-submission-files">
                      {ownSubmission.file_paths.map((filePath) => (
                        <li key={filePath}>
                          <a href={submissionFileUrl(filePath)} rel="noreferrer" target="_blank">
                            {filePath.split(/[/\\]/).pop()}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
            <form
              className="workspace-form"
              onSubmit={(event) => void handleStudentSubmit(event, assignment.id)}
            >
              <label>
                <span>Submission text</span>
                <textarea
                  name="body"
                  placeholder="Write your response..."
                  defaultValue={ownSubmission?.body ?? ''}
                />
                <p className="workspace-muted">
                  Paste a public GitHub repo URL in your submission text to enable project and CV
                  help in SWINLEARN.
                </p>
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
      <div
        className={`course-detail-layout course-detail-layout--modules${
          modulesCollapsed ? ' course-detail-layout--modules-collapsed' : ''
        }`}
      >
        <aside
          id="course-detail-modules-panel"
          className={`workspace-panel course-detail-nav${
            modulesCollapsed ? ' course-detail-nav--collapsed' : ''
          }`}
        >
          <div className="course-detail-module-header">
            {!modulesCollapsed && <h2>Modules</h2>}
            <button
              type="button"
              className="course-detail-module-toggle"
              aria-controls="course-detail-modules-panel"
              aria-expanded={!modulesCollapsed}
              aria-label={modulesCollapsed ? 'Show modules' : 'Collapse modules'}
              title={modulesCollapsed ? 'Show modules' : 'Collapse modules'}
              onClick={() => setModulesCollapsed((current) => !current)}
            >
              {modulesCollapsed ? '>' : '<'}
            </button>
          </div>

          {!modulesCollapsed && (
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
          )}
        </aside>

        <main className="workspace-panel course-detail-main" ref={moduleContentRef}>
          {activeContentItem ? (
            <>
              <div className="workspace-section-heading">
                <div>
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
    <>
      {workspaceRole === 'teacher' && detail && (
        <section className="workspace-panel course-detail-swinlearn-index">
          <SwinlearnKnowledgeIndexPanel
            assignmentCount={detail.assignments.length}
            hasContentPackage={Boolean(detail.contentPackage)}
            knowledgeIndex={detail.knowledge_index}
            disabled={saving}
            indexing={saving}
            onIndex={() => void handleIndexKnowledge()}
          />
        </section>
      )}

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
    </>
  )

  const renderGradesSection = () => (
    <section className="workspace-panel course-detail-grades-panel">
      <div className="workspace-section-heading">
        <div>
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

  const renderCommunitySection = () => {
    if (communityLoading) {
      return <section className="workspace-panel">Loading community...</section>
    }

    return (
      <section className="workspace-panel course-detail-community-panel">
        <div className="workspace-section-heading">
          <div>
            <h2>Community</h2>
            <p>Share questions and help classmates in this course. Posts stay inside this class.</p>
          </div>
          <div className="course-detail-community-heading-actions">
            {workspaceRole === 'student' && (
              <span className="course-detail-community-gold-chip" aria-label="Your Swin gold balance">
                🪙 {communityViewerGold} gold
              </span>
            )}
            {!isCommunityPostComposerOpen && (
              <button
                type="button"
                className="workspace-primary-action course-detail-community-disclosure"
                onClick={() => setCommunityPostComposerOpen(true)}
              >
                New post
              </button>
            )}
          </div>
        </div>

        {isCommunityPostComposerOpen && (
          <form className="workspace-form course-detail-community-composer" onSubmit={(event) => void handleCommunityPost(event)}>
            <label>
              <span>New post</span>
              <textarea
                value={newPostBody}
                onChange={(event) => setNewPostBody(event.target.value)}
                onPaste={handleCommunityPostPaste}
                placeholder="Ask a question, paste a screenshot (Ctrl+V), or share something with your classmates..."
                rows={3}
              />
            </label>

            <div className="course-detail-community-composer-tools">
              <label className="course-detail-community-upload">
                <span>Add images</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  disabled={pendingPostImages.length >= communityMaxImagesPerPost}
                  onChange={(event) => {
                    addPendingPostImages(Array.from(event.target.files ?? []))
                    event.target.value = ''
                  }}
                />
              </label>
              <span className="workspace-chip">
                {pendingPostImages.length}/{communityMaxImagesPerPost} images
              </span>
            </div>

            {pendingPostImages.length > 0 && (
              <div className="course-detail-community-pending-images" aria-label="Images to upload">
                {pendingPostImages.map((image, index) => (
                  <figure className="course-detail-community-pending-image" key={`${image.name}-${index}`}>
                    <img src={pendingImagePreviews[index]} alt={image.name || `Image ${index + 1}`} />
                    <button
                      type="button"
                      className="course-detail-community-delete"
                      onClick={() => removePendingPostImage(index)}
                    >
                      Remove
                    </button>
                  </figure>
                ))}
              </div>
            )}

            <div className="course-detail-community-form-actions">
              <button
                type="submit"
                disabled={saving || (!newPostBody.trim() && pendingPostImages.length === 0)}
              >
                {saving ? 'Posting...' : 'Post'}
              </button>
              <button
                type="button"
                className="course-detail-community-secondary-action"
                disabled={saving}
                onClick={() => {
                  setCommunityPostComposerOpen(false)
                  setNewPostBody('')
                  setPendingPostImages([])
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="course-detail-community-feed">
          {communityPosts.map((post) => {
            const isCommentsOpen = Boolean(openCommunityCommentPostIds[post.id])

            return (
              <article
                className={`course-detail-community-post${highlightPostId === post.id ? ' course-detail-community-post--highlight' : ''}`}
                id={`community-post-${post.id}`}
                key={post.id}
              >
                <CommunityAuthorHeader author={post.author} createdAt={post.created_at} />

                <div className="course-detail-community-body">
                  {post.body && <p className="course-detail-community-post-body">{post.body}</p>}

                  {post.images.length > 0 && (
                    <div className="course-detail-community-images">
                      {post.images.map((image, imageIndex) => (
                        <button
                          key={image.id}
                          type="button"
                          className="course-detail-community-image-button"
                          aria-label={`View ${image.original_name}`}
                          onClick={() => openCommunityImagePreview(post.images, imageIndex)}
                        >
                          <img
                            className="course-detail-community-image"
                            src={image.public_url}
                            alt={image.original_name}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="course-detail-community-toolbar">
                  <CommunityVoteButton
                    active={post.liked_by_me}
                    count={post.like_count}
                    onClick={() => void handleCommunityLike(post.id)}
                  />
                  <button
                    type="button"
                    className="course-detail-community-toolbar-btn"
                    aria-expanded={isCommentsOpen}
                    onClick={() => toggleCommunityComments(post.id)}
                  >
                    {isCommentsOpen ? 'Hide comments' : 'Comment'} ({post.comment_count})
                  </button>
                  <button
                    type="button"
                    className="course-detail-community-toolbar-btn"
                    onClick={() => setSharePost(post)}
                  >
                    Share
                  </button>
                  {post.can_delete && (
                    <button
                      type="button"
                      className="course-detail-community-toolbar-btn course-detail-community-toolbar-btn--danger"
                      disabled={saving}
                      onClick={() => setPendingDeletePostId(post.id)}
                    >
                      Delete
                    </button>
                  )}
                </footer>

                {isCommentsOpen && (
                  <CommunityCommentThread
                    comments={post.comments}
                    courseId={courseId}
                    onError={(message) => setError(message)}
                    onImagePreview={openCommunityImagePreview}
                    onRefresh={() => loadCommunity({ silent: true })}
                    postAuthorId={post.author_id}
                    postId={post.id}
                    saving={saving}
                    setSaving={setSaving}
                  />
                )}
              </article>
            )
          })}

          {communityPosts.length === 0 && (
            <div className="workspace-empty-state">
              No posts yet. Be the first to start a discussion.
            </div>
          )}
        </div>

        {pendingDeletePostId && (
          <CommunityConfirmDialog
            message="This post and all its comments will be permanently removed."
            onCancel={() => setPendingDeletePostId(null)}
            onConfirm={() => void handleDeleteCommunityPost()}
            saving={saving}
            title="Delete this post?"
          />
        )}

        {sharePost && detail && (
          <CommunityShareModal
            courseCode={detail.course.code}
            courseId={courseId}
            courseMemberIds={detail.course.members.map((member) => member.user_id)}
            onClose={() => setSharePost(null)}
            onError={(message) => setError(message)}
            onSuccess={(message) => {
              setSharePost(null)
              setNotice(message)
            }}
            post={sharePost}
            workspaceRole={workspaceRole}
          />
        )}
      </section>
      )
    }

  const renderWorkspaceAlerts = () => (
    (error !== '' || notice !== '') && (
      <div className="workspace-alert-stack" aria-live="polite">
        {error !== '' && (
          <div className="workspace-alert workspace-alert--error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="workspace-alert-close"
              aria-label="Dismiss error alert"
              onClick={() => setError('')}
            >
              ×
            </button>
          </div>
        )}
        {notice !== '' && (
          <div className="workspace-alert workspace-alert--success" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="workspace-alert-close"
              aria-label="Dismiss success alert"
              onClick={() => setNotice('')}
            >
              ×
            </button>
          </div>
        )}
      </div>
    )
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

    if (activeSection === 'community') {
      return renderCommunitySection()
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
        {renderWorkspaceAlerts()}
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

      {renderWorkspaceAlerts()}

      {renderActiveSection()}
      {renderCommunityImageLightbox()}
    </section>
  )
}

export default CourseDetailPage
