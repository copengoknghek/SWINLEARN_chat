import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addCourseMember,
  courseLabel,
  createCourseWithTeacher,
  deleteCourse,
  fetchAdminCourseData,
  getErrorMessage,
  profileName,
  removeCourseMember,
  setTeachingAssistant,
  updateCourse,
} from '../../lib/workspace/api'
import type {
  AdminCourseData,
  CourseMemberRole,
  CourseMutationInput,
  CourseWithMembers,
  ProfileRow,
} from '../../lib/workspace/types'

const currentYear = new Date().getFullYear()

const emptyCourseForm = (childMajorId = ''): CourseMutationInput => ({
  child_major_id: childMajorId,
  code: '',
  title: '',
  description: '',
  semester: 'current',
  academic_year: currentYear,
  status: 'active',
})

const memberRoleLabel: Record<CourseMemberRole, string> = {
  teacher: 'Teacher',
  teaching_assistant: 'Teaching assistant',
  student: 'Student',
}

function AdminCoursesPage() {
  const [data, setData] = useState<AdminCourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedChildId, setSelectedChildId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(emptyCourseForm())
  const [initialTeacherId, setInitialTeacherId] = useState('')
  const [teacherToAdd, setTeacherToAdd] = useState('')
  const [assistantToSet, setAssistantToSet] = useState('')
  const [studentToAdd, setStudentToAdd] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const nextData = await fetchAdminCourseData()
      setData(nextData)

      const firstMainId = selectedMainId || nextData.mainMajors[0]?.id || ''
      const firstChildId =
        selectedChildId ||
        nextData.childMajors.find((childMajor) => childMajor.main_major_id === firstMainId)?.id ||
        ''

      setSelectedMainId(firstMainId)
      setSelectedChildId(firstChildId)
      setCourseForm((current) => ({
        ...current,
        child_major_id: current.child_major_id || firstChildId,
      }))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Course data could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [selectedChildId, selectedMainId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const profilesById = useMemo(() => {
    const map = new Map<string, ProfileRow>()

    for (const profile of data?.profiles ?? []) {
      map.set(profile.id, profile)
    }

    return map
  }, [data])

  const selectedMainMajors = data?.mainMajors ?? []
  const selectedChildMajors = (data?.childMajors ?? []).filter(
    (childMajor) => childMajor.main_major_id === selectedMainId,
  )
  const selectedCourses = (data?.courses ?? []).filter(
    (course) => course.child_major_id === selectedChildId,
  )
  const selectedCourse = selectedCourseId
    ? selectedCourses.find((course) => course.id === selectedCourseId) ?? null
    : null

  const teachers = (data?.profiles ?? []).filter(
    (profile) => profile.role === 'teacher' && profile.status === 'active',
  )
  const students = (data?.profiles ?? []).filter(
    (profile) => profile.role === 'student' && profile.status === 'active',
  )

  const handleMainMajorClick = (mainMajorId: string) => {
    const firstChildId =
      data?.childMajors.find((childMajor) => childMajor.main_major_id === mainMajorId)?.id ?? ''

    setSelectedMainId(mainMajorId)
    setSelectedChildId(firstChildId)
    setSelectedCourseId('')
    setCourseForm(emptyCourseForm(firstChildId))
  }

  const handleChildMajorClick = (childMajorId: string) => {
    setSelectedChildId(childMajorId)
    setSelectedCourseId('')
    setCourseForm(emptyCourseForm(childMajorId))
  }

  const handleCourseSelect = (course: CourseWithMembers) => {
    setSelectedCourseId(course.id)
    setCourseForm({
      child_major_id: course.child_major_id,
      code: course.code,
      title: course.title,
      description: course.description,
      semester: course.semester,
      academic_year: course.academic_year,
      status: course.status,
    })
  }

  const handleNewCourse = () => {
    setSelectedCourseId('')
    setCourseForm(emptyCourseForm(selectedChildId))
    setInitialTeacherId(teachers[0]?.id ?? '')
    setNotice('')
    setError('')
  }

  const handleCourseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const trimmedForm: CourseMutationInput = {
        ...courseForm,
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        description: courseForm.description.trim(),
      }

      if (selectedCourseId) {
        await updateCourse(selectedCourseId, trimmedForm)
        setNotice('Course updated.')
      } else {
        if (!initialTeacherId) {
          throw new Error('Choose at least one teacher before creating a course.')
        }

        const nextCourseId = await createCourseWithTeacher(trimmedForm, initialTeacherId)
        setSelectedCourseId(nextCourseId)
        setNotice('Course created with its first teacher.')
      }

      await loadData()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Course could not be saved'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCourse = async () => {
    if (!selectedCourseId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await deleteCourse(selectedCourseId)
      setSelectedCourseId('')
      setCourseForm(emptyCourseForm(selectedChildId))
      setNotice('Course deleted.')
      await loadData()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Course could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (role: CourseMemberRole, userId: string) => {
    if (!selectedCourse || !userId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await addCourseMember(selectedCourse.id, userId, role)
      setNotice(`${memberRoleLabel[role]} added.`)
      await loadData()
    } catch (memberError) {
      setError(getErrorMessage(memberError, 'Member could not be added'))
    } finally {
      setSaving(false)
    }
  }

  const handleSetAssistant = async () => {
    if (!selectedCourse) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await setTeachingAssistant(selectedCourse.id, assistantToSet || null)
      setNotice(assistantToSet ? 'Teaching assistant updated.' : 'Teaching assistant removed.')
      await loadData()
    } catch (assistantError) {
      setError(getErrorMessage(assistantError, 'Teaching assistant could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (course: CourseWithMembers, membershipId: string) => {
    const membership = course.members.find((item) => item.id === membershipId)
    const teacherCount = course.members.filter((item) => item.role === 'teacher').length

    if (membership?.role === 'teacher' && teacherCount <= 1 && course.status === 'active') {
      setError('Active courses must keep at least one teacher.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await removeCourseMember(membershipId)
      setNotice('Member removed.')
      await loadData()
    } catch (removeError) {
      setError(getErrorMessage(removeError, 'Member could not be removed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Admin workspace</span>
        <h1 className="workspace-page-title">Course management</h1>
        <p className="workspace-page-subtitle">
          Manage majors, course units, teaching teams, teaching assistants, and
          student enrollments from one view.
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      {loading ? (
        <section className="workspace-panel">Loading courses...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-grid" aria-label="Major and course browser">
            <div className="workspace-toolbar" aria-label="Main majors">
              {selectedMainMajors.map((mainMajor) => (
                <button
                  key={mainMajor.id}
                  type="button"
                  className={`workspace-tab${selectedMainId === mainMajor.id ? ' workspace-tab--active' : ''}`}
                  onClick={() => handleMainMajorClick(mainMajor.id)}
                >
                  {mainMajor.title}
                </button>
              ))}
            </div>

            <div className="workspace-toolbar" aria-label="Child majors">
              {selectedChildMajors.map((childMajor) => (
                <button
                  key={childMajor.id}
                  type="button"
                  className={`workspace-tab workspace-tab--quiet${selectedChildId === childMajor.id ? ' workspace-tab--active' : ''}`}
                  onClick={() => handleChildMajorClick(childMajor.id)}
                >
                  {childMajor.title}
                </button>
              ))}
            </div>

            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>Courses</h2>
                  <p>{selectedCourses.length} course units in this child major.</p>
                </div>
                <button
                  type="button"
                  className="workspace-secondary-action"
                  onClick={handleNewCourse}
                >
                  New course
                </button>
              </div>

              <div className="workspace-table" role="table" aria-label="Courses">
                {selectedCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className={`workspace-row workspace-row--button${selectedCourse?.id === course.id ? ' workspace-row--active' : ''}`}
                    onClick={() => handleCourseSelect(course)}
                  >
                    <span>
                      <strong>{course.code}</strong>
                      <small>{course.title}</small>
                    </span>
                    <span>{course.semester}</span>
                    <span>{course.status}</span>
                  </button>
                ))}

                {selectedCourses.length === 0 && (
                  <div className="workspace-empty-state">No courses yet. Create the first course.</div>
                )}
              </div>
            </section>

            {selectedCourse && (
              <section className="workspace-panel">
                <div className="workspace-section-heading">
                  <div>
                    <h2>{courseLabel(selectedCourse)}</h2>
                    <p>Teaching team and student enrollment.</p>
                  </div>
                </div>

                <div className="workspace-member-list">
                  {selectedCourse.members.map((membership) => {
                    const profile = profilesById.get(membership.user_id)

                    return (
                      <div className="workspace-member" key={membership.id}>
                        <div>
                          <strong>{profileName(profile)}</strong>
                          <span>{memberRoleLabel[membership.role]}</span>
                        </div>
                        <button
                          type="button"
                          className="workspace-danger-action"
                          onClick={() => void handleRemoveMember(selectedCourse, membership.id)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="workspace-form workspace-form--inline">
                  <label>
                    <span>Add teacher</span>
                    <select value={teacherToAdd} onChange={(event) => setTeacherToAdd(event.target.value)}>
                      <option value="">Choose teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {profileName(teacher)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleAddMember('teacher', teacherToAdd)}
                    disabled={saving || !teacherToAdd}
                  >
                    Add
                  </button>
                </div>

                <div className="workspace-form workspace-form--inline">
                  <label>
                    <span>Teaching assistant</span>
                    <select
                      value={assistantToSet}
                      onChange={(event) => setAssistantToSet(event.target.value)}
                    >
                      <option value="">No teaching assistant</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {profileName(teacher)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => void handleSetAssistant()} disabled={saving}>
                    Save TA
                  </button>
                </div>

                <div className="workspace-form workspace-form--inline">
                  <label>
                    <span>Add student</span>
                    <select value={studentToAdd} onChange={(event) => setStudentToAdd(event.target.value)}>
                      <option value="">Choose student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {profileName(student)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleAddMember('student', studentToAdd)}
                    disabled={saving || !studentToAdd}
                  >
                    Add
                  </button>
                </div>
              </section>
            )}
          </section>

          <aside className="workspace-panel">
            <div className="workspace-section-heading">
              <div>
                <h2>{selectedCourseId ? 'Edit course' : 'Create course'}</h2>
                <p>Active courses require at least one teacher.</p>
              </div>
            </div>

            <form className="workspace-form" onSubmit={(event) => void handleCourseSubmit(event)}>
              <label>
                <span>Child major</span>
                <select
                  value={courseForm.child_major_id}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, child_major_id: event.target.value }))
                  }
                  required
                >
                  {(data?.childMajors ?? []).map((childMajor) => (
                    <option key={childMajor.id} value={childMajor.id}>
                      {childMajor.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Course code</span>
                <input
                  value={courseForm.code}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="COS10009"
                  required
                />
              </label>

              <label>
                <span>Course title</span>
                <input
                  value={courseForm.title}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Introduction to Programming"
                  required
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  value={courseForm.description}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>

              <div className="workspace-form-grid">
                <label>
                  <span>Semester</span>
                  <select
                    value={courseForm.semester}
                    onChange={(event) =>
                      setCourseForm((current) => ({
                        ...current,
                        semester: event.target.value as CourseMutationInput['semester'],
                      }))
                    }
                  >
                    <option value="previous">Previous</option>
                    <option value="current">Current</option>
                    <option value="next">Next</option>
                  </select>
                </label>

                <label>
                  <span>Year</span>
                  <input
                    type="number"
                    value={courseForm.academic_year}
                    onChange={(event) =>
                      setCourseForm((current) => ({
                        ...current,
                        academic_year: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <label>
                <span>Status</span>
                <select
                  value={courseForm.status}
                  onChange={(event) =>
                    setCourseForm((current) => ({
                      ...current,
                      status: event.target.value as CourseMutationInput['status'],
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              {!selectedCourseId && (
                <label>
                  <span>First teacher</span>
                  <select
                    value={initialTeacherId}
                    onChange={(event) => setInitialTeacherId(event.target.value)}
                    required
                  >
                    <option value="">Choose teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {profileName(teacher)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : selectedCourseId ? 'Save course' : 'Create course'}
              </button>

              {selectedCourseId && (
                <button
                  type="button"
                  className="workspace-danger-action workspace-danger-action--wide"
                  onClick={() => void handleDeleteCourse()}
                  disabled={saving}
                >
                  Delete course
                </button>
              )}
            </form>
          </aside>
        </div>
      )}
    </section>
  )
}

export default AdminCoursesPage
