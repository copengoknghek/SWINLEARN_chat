import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addCourseMember,
  courseLabel,
  createCourse,
  createCourseOffering,
  createCurriculumRule,
  deleteCourse,
  deleteCourseOffering,
  deleteCurriculumRule,
  fetchAdminCourseData,
  getErrorMessage,
  profileName,
  removeCourseMember,
  setTeachingAssistant,
  updateCourse,
  updateCourseOffering,
} from '../../lib/workspace/api'
import type {
  AdminCourseData,
  CourseCatalogInput,
  CourseCatalogRow,
  CourseMemberRole,
  CourseOfferingInput,
  CourseTerm,
  CourseWithMembers,
  CurriculumRuleInput,
  CurriculumRuleRow,
  ProfileRow,
} from '../../lib/workspace/types'

const currentYear = new Date().getFullYear()

const termLabels: Record<CourseTerm, string> = {
  semester_1: 'Semester 1',
  semester_2: 'Semester 2',
  summer: 'Summer',
}

const ruleTypeLabels: Record<CurriculumRuleInput['rule_type'], string> = {
  core: 'Core',
  elective: 'Elective',
  major: 'Major',
}

const scopeLabels: Record<CurriculumRuleInput['scope'], string> = {
  global: 'All main majors',
  main_major: 'Main major',
  child_major: 'Child major',
}

const memberRoleLabel: Record<CourseMemberRole, string> = {
  teacher: 'Teacher',
  teaching_assistant: 'Teaching assistant',
  student: 'Student',
}

const emptyCourseForm = (): CourseCatalogInput => ({
  code: '',
  title: '',
  description: '',
})

const emptyRuleForm = (
  courseId = '',
  childMajorId = '',
): CurriculumRuleInput => ({
  course_id: courseId,
  rule_type: 'major',
  scope: 'child_major',
  main_major_id: null,
  child_major_id: childMajorId,
})

const emptyOfferingForm = (courseId = ''): CourseOfferingInput => ({
  course_id: courseId,
  term: 'semester_1',
  academic_year: currentYear,
  status: 'active',
})

const curriculumRuleAppliesToChildMajor = (
  rule: CurriculumRuleRow,
  mainMajorId: string,
  childMajorId: string,
) => {
  if (rule.scope === 'global') {
    return true
  }

  if (rule.scope === 'main_major') {
    return rule.main_major_id === mainMajorId
  }

  return rule.child_major_id === childMajorId
}

const ruleScopeDetail = (
  rule: CurriculumRuleRow,
  data: AdminCourseData,
) => {
  if (rule.scope === 'global') {
    return 'All main majors'
  }

  if (rule.scope === 'main_major') {
    return data.mainMajors.find((major) => major.id === rule.main_major_id)?.title ?? 'Main major'
  }

  return data.childMajors.find((major) => major.id === rule.child_major_id)?.title ?? 'Child major'
}

function AdminCoursesPage() {
  const [data, setData] = useState<AdminCourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedChildId, setSelectedChildId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedOfferingId, setSelectedOfferingId] = useState('')
  const [courseForm, setCourseForm] = useState<CourseCatalogInput>(emptyCourseForm())
  const [ruleForm, setRuleForm] = useState<CurriculumRuleInput>(emptyRuleForm())
  const [offeringForm, setOfferingForm] = useState<CourseOfferingInput>(emptyOfferingForm())
  const [initialTeacherId, setInitialTeacherId] = useState('')
  const [teacherToAdd, setTeacherToAdd] = useState('')
  const [assistantToSet, setAssistantToSet] = useState('')
  const [studentToAdd, setStudentToAdd] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const nextData = await fetchAdminCourseData()
      const firstMainId = selectedMainId || nextData.mainMajors[0]?.id || ''
      const firstChildId =
        selectedChildId ||
        nextData.childMajors.find((childMajor) => childMajor.main_major_id === firstMainId)?.id ||
        ''
      const firstCourseId = selectedCourseId || nextData.courses[0]?.id || ''
      const firstCourse = nextData.courses.find((course) => course.id === firstCourseId) ?? null

      setData(nextData)
      setSelectedMainId(firstMainId)
      setSelectedChildId(firstChildId)
      setSelectedCourseId(firstCourseId)
      setInitialTeacherId((current) => current || nextData.profiles.find(
        (profile) => profile.role === 'teacher' && profile.status === 'active',
      )?.id || '')

      if (!selectedCourseId && firstCourse) {
        setCourseForm({
          code: firstCourse.code,
          title: firstCourse.title,
          description: firstCourse.description,
        })
      }

      setRuleForm((current) => ({
        ...current,
        course_id: current.course_id || firstCourseId,
        child_major_id: current.child_major_id || firstChildId,
      }))
      setOfferingForm((current) => ({
        ...current,
        course_id: current.course_id || firstCourseId,
      }))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Course data could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [selectedChildId, selectedCourseId, selectedMainId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const coursesById = useMemo(() => {
    const map = new Map<string, CourseCatalogRow>()

    for (const course of data?.courses ?? []) {
      map.set(course.id, course)
    }

    return map
  }, [data?.courses])

  const profilesById = useMemo(() => {
    const map = new Map<string, ProfileRow>()

    for (const profile of data?.profiles ?? []) {
      map.set(profile.id, profile)
    }

    return map
  }, [data?.profiles])

  const selectedMainMajors = data?.mainMajors ?? []
  const selectedChildMajors = (data?.childMajors ?? []).filter(
    (childMajor) => childMajor.main_major_id === selectedMainId,
  )
  const selectedCurriculumRules = (data?.curriculumRules ?? []).filter((rule) =>
    curriculumRuleAppliesToChildMajor(rule, selectedMainId, selectedChildId),
  )
  const selectedCourse = selectedCourseId ? coursesById.get(selectedCourseId) ?? null : null
  const selectedCourseOfferings = (data?.offerings ?? []).filter(
    (offering) => offering.catalog_course_id === selectedCourseId,
  )
  const selectedOffering = selectedOfferingId
    ? selectedCourseOfferings.find((offering) => offering.id === selectedOfferingId) ?? null
    : null

  const teachers = (data?.profiles ?? []).filter(
    (profile) => profile.role === 'teacher' && profile.status === 'active',
  )
  const students = (data?.profiles ?? []).filter(
    (profile) => profile.role === 'student' && profile.status === 'active',
  )

  const setSelectedCourse = (course: CourseCatalogRow) => {
    setSelectedCourseId(course.id)
    setSelectedOfferingId('')
    setCourseForm({
      code: course.code,
      title: course.title,
      description: course.description,
    })
      setRuleForm(emptyRuleForm(course.id, selectedChildId))
    setOfferingForm(emptyOfferingForm(course.id))
  }

  const handleMainMajorClick = (mainMajorId: string) => {
    const firstChildId =
      data?.childMajors.find((childMajor) => childMajor.main_major_id === mainMajorId)?.id ?? ''

    setSelectedMainId(mainMajorId)
    setSelectedChildId(firstChildId)
    setRuleForm((current) => ({
      ...current,
      main_major_id: current.scope === 'main_major' ? mainMajorId : null,
      child_major_id: current.scope === 'child_major' ? firstChildId : null,
    }))
  }

  const handleChildMajorClick = (childMajorId: string) => {
    setSelectedChildId(childMajorId)
    setRuleForm((current) => ({
      ...current,
      child_major_id: current.scope === 'child_major' ? childMajorId : null,
    }))
  }

  const handleNewCourse = () => {
    setSelectedCourseId('')
    setSelectedOfferingId('')
    setCourseForm(emptyCourseForm())
    setRuleForm(emptyRuleForm('', selectedChildId))
    setOfferingForm(emptyOfferingForm(''))
    setNotice('')
    setError('')
  }

  const handleCourseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const input = {
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        description: courseForm.description.trim(),
      }

      if (selectedCourseId) {
        await updateCourse(selectedCourseId, input)
        setNotice('Catalog course updated.')
      } else {
        const nextCourseId = await createCourse(input)
        setSelectedCourseId(nextCourseId)
        setRuleForm(emptyRuleForm(nextCourseId, selectedChildId))
        setOfferingForm(emptyOfferingForm(nextCourseId))
        setNotice('Catalog course created.')
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
      setSelectedOfferingId('')
      setCourseForm(emptyCourseForm())
      setNotice('Catalog course deleted.')
      await loadData()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Course could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  const handleRuleTypeChange = (ruleType: CurriculumRuleInput['rule_type']) => {
    if (ruleType === 'core') {
      setRuleForm((current) => ({
        ...current,
        rule_type: ruleType,
        scope: 'main_major',
        main_major_id: selectedMainId,
        child_major_id: null,
      }))
      return
    }

    if (ruleType === 'major') {
      setRuleForm((current) => ({
        ...current,
        rule_type: ruleType,
        scope: 'child_major',
        main_major_id: null,
        child_major_id: selectedChildId,
      }))
      return
    }

    setRuleForm((current) => ({
      ...current,
      rule_type: ruleType,
      scope: 'global',
      main_major_id: null,
      child_major_id: null,
    }))
  }

  const handleRuleScopeChange = (scope: CurriculumRuleInput['scope']) => {
    setRuleForm((current) => ({
      ...current,
      scope,
      main_major_id: scope === 'main_major' ? selectedMainId : null,
      child_major_id: scope === 'child_major' ? selectedChildId : null,
    }))
  }

  const handleRuleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await createCurriculumRule(ruleForm)
      setNotice('Curriculum rule added.')
      await loadData()
    } catch (ruleError) {
      setError(getErrorMessage(ruleError, 'Curriculum rule could not be saved'))
    } finally {
      setSaving(false)
    }
  }

  const handleRuleDelete = async (ruleId: string) => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await deleteCurriculumRule(ruleId)
      setNotice('Curriculum rule removed.')
      await loadData()
    } catch (ruleError) {
      setError(getErrorMessage(ruleError, 'Curriculum rule could not be removed'))
    } finally {
      setSaving(false)
    }
  }

  const handleOfferingSelect = (offering: CourseWithMembers) => {
    setSelectedOfferingId(offering.id)
    setOfferingForm({
      course_id: offering.catalog_course_id,
      term: offering.term,
      academic_year: offering.academic_year,
      status: offering.status,
    })
  }

  const handleNewOffering = () => {
    setSelectedOfferingId('')
    setOfferingForm(emptyOfferingForm(selectedCourseId))
    setInitialTeacherId(teachers[0]?.id ?? '')
  }

  const handleOfferingSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (selectedOfferingId) {
        await updateCourseOffering(selectedOfferingId, offeringForm)
        setNotice('Course offering updated.')
      } else {
        await createCourseOffering(offeringForm, initialTeacherId)
        setNotice('Course offering created.')
      }

      await loadData()
    } catch (offeringError) {
      setError(getErrorMessage(offeringError, 'Course offering could not be saved'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOffering = async () => {
    if (!selectedOfferingId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await deleteCourseOffering(selectedOfferingId)
      setSelectedOfferingId('')
      setOfferingForm(emptyOfferingForm(selectedCourseId))
      setNotice('Course offering deleted.')
      await loadData()
    } catch (offeringError) {
      setError(getErrorMessage(offeringError, 'Course offering could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (role: CourseMemberRole, userId: string) => {
    if (!selectedOffering || !userId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await addCourseMember(selectedOffering.id, userId, role)
      setNotice(`${memberRoleLabel[role]} added.`)
      await loadData()
    } catch (memberError) {
      setError(getErrorMessage(memberError, 'Member could not be added'))
    } finally {
      setSaving(false)
    }
  }

  const handleSetAssistant = async () => {
    if (!selectedOffering) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await setTeachingAssistant(selectedOffering.id, assistantToSet || null)
      setNotice(assistantToSet ? 'Teaching assistant updated.' : 'Teaching assistant removed.')
      await loadData()
    } catch (assistantError) {
      setError(getErrorMessage(assistantError, 'Teaching assistant could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (offering: CourseWithMembers, membershipId: string) => {
    const membership = offering.members.find((item) => item.id === membershipId)
    const teacherCount = offering.members.filter((item) => item.role === 'teacher').length

    if (membership?.role === 'teacher' && teacherCount <= 1 && offering.status === 'active') {
      setError('Active offerings must keep at least one teacher.')
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
          Manage reusable catalog courses, curriculum rules, semester offerings,
          teaching teams, and student enrollments from one view.
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      {loading ? (
        <section className="workspace-panel">Loading courses...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-grid admin-course-browser" aria-label="Curriculum browser">
            <div className="admin-course-picker-group admin-course-picker-group--main">
              <span className="admin-course-picker-label">Majors</span>
              <div
                className="workspace-toolbar admin-course-picker admin-course-picker--main"
                aria-label="Main majors"
              >
                {selectedMainMajors.map((mainMajor) => (
                  <button
                    key={mainMajor.id}
                    type="button"
                    className={`workspace-tab admin-course-tab${selectedMainId === mainMajor.id ? ' workspace-tab--active' : ''}`}
                    onClick={() => handleMainMajorClick(mainMajor.id)}
                  >
                    {mainMajor.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-course-picker-group admin-course-picker-group--child">
              <span className="admin-course-picker-label"></span>
              <div
                className="workspace-toolbar admin-course-picker admin-course-picker--child"
                aria-label="Child majors"
              >
                {selectedChildMajors.map((childMajor) => (
                  <button
                    key={childMajor.id}
                    type="button"
                    className={`workspace-tab workspace-tab--quiet admin-course-tab${selectedChildId === childMajor.id ? ' workspace-tab--active' : ''}`}
                    onClick={() => handleChildMajorClick(childMajor.id)}
                  >
                    {childMajor.title}
                  </button>
                ))}
              </div>
            </div>

            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>Curriculum courses</h2>
                  <p>{selectedCurriculumRules.length} rules visible for this child major.</p>
                </div>
                <button
                  type="button"
                  className="workspace-secondary-action"
                  onClick={handleNewCourse}
                >
                  New catalog course
                </button>
              </div>

              <div className="workspace-table" role="table" aria-label="Curriculum courses">
                {selectedCurriculumRules.map((rule) => {
                  const course = coursesById.get(rule.course_id)

                  if (!course) {
                    return null
                  }

                  return (
                    <button
                      key={rule.id}
                      type="button"
                      className={`workspace-row workspace-row--button${selectedCourseId === course.id ? ' workspace-row--active' : ''}`}
                      onClick={() => setSelectedCourse(course)}
                    >
                      <span>
                        <strong>{course.code}</strong>
                        <small>{course.title}</small>
                      </span>
                      <span>{ruleTypeLabels[rule.rule_type]}</span>
                      <span>{scopeLabels[rule.scope]}</span>
                    </button>
                  )
                })}

                {selectedCurriculumRules.length === 0 && (
                  <div className="workspace-empty-state">
                    No curriculum rules yet. Add a catalog course and attach a rule.
                  </div>
                )}
              </div>
            </section>

            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>Catalog</h2>
                  <p>{data?.courses.length ?? 0} reusable course records.</p>
                </div>
              </div>
              <div className="workspace-table" role="table" aria-label="Course catalog">
                {(data?.courses ?? []).map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className={`workspace-row workspace-row--button${selectedCourseId === course.id ? ' workspace-row--active' : ''}`}
                    onClick={() => setSelectedCourse(course)}
                  >
                    <span>
                      <strong>{course.code}</strong>
                      <small>{course.title}</small>
                    </span>
                    <span>Catalog</span>
                    <span>{(data?.offerings ?? []).filter((item) => item.catalog_course_id === course.id).length} offerings</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedCourse && (
              <section className="workspace-panel">
                <div className="workspace-section-heading">
                  <div>
                    <h2>{selectedCourse.code} offerings</h2>
                    <p>Semester/year instances used for teaching and enrollment.</p>
                  </div>
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    onClick={handleNewOffering}
                  >
                    New offering
                  </button>
                </div>

                <div className="workspace-table" role="table" aria-label="Course offerings">
                  {selectedCourseOfferings.map((offering) => (
                    <button
                      key={offering.id}
                      type="button"
                      className={`workspace-row workspace-row--button${selectedOfferingId === offering.id ? ' workspace-row--active' : ''}`}
                      onClick={() => handleOfferingSelect(offering)}
                    >
                      <span>
                        <strong>{termLabels[offering.term]}</strong>
                        <small>{offering.academic_year}</small>
                      </span>
                      <span>{offering.status}</span>
                      <span>{offering.members.length} members</span>
                    </button>
                  ))}

                  {selectedCourseOfferings.length === 0 && (
                    <div className="workspace-empty-state">No offerings yet.</div>
                  )}
                </div>
              </section>
            )}

            {selectedOffering && (
              <section className="workspace-panel">
                <div className="workspace-section-heading">
                  <div>
                    <h2>{courseLabel(selectedOffering)}</h2>
                    <p>Teaching team and student enrollment.</p>
                  </div>
                </div>

                <div className="workspace-member-list">
                  {selectedOffering.members.map((membership) => {
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
                          onClick={() => void handleRemoveMember(selectedOffering, membership.id)}
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

          <aside className="workspace-grid">
            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>{selectedCourseId ? 'Edit catalog course' : 'Create catalog course'}</h2>
                  <p>Catalog courses are reusable across majors and offerings.</p>
                </div>
              </div>

              <form className="workspace-form" onSubmit={(event) => void handleCourseSubmit(event)}>
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

                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : selectedCourseId ? 'Save catalog course' : 'Create catalog course'}
                </button>

                {selectedCourseId && (
                  <button
                    type="button"
                    className="workspace-danger-action workspace-danger-action--wide"
                    onClick={() => void handleDeleteCourse()}
                    disabled={saving}
                  >
                    Delete catalog course
                  </button>
                )}
              </form>
            </section>

            <section className="workspace-panel">
              <h2>Add curriculum rule</h2>
              <form className="workspace-form" onSubmit={(event) => void handleRuleSubmit(event)}>
                <label>
                  <span>Catalog course</span>
                  <select
                    value={ruleForm.course_id}
                    onChange={(event) =>
                      setRuleForm((current) => ({ ...current, course_id: event.target.value }))
                    }
                    required
                  >
                    <option value="">Choose course</option>
                    {(data?.courses ?? []).map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Type</span>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(event) =>
                      handleRuleTypeChange(event.target.value as CurriculumRuleInput['rule_type'])
                    }
                  >
                    <option value="core">Core</option>
                    <option value="elective">Elective</option>
                    <option value="major">Major</option>
                  </select>
                </label>

                <label>
                  <span>Scope</span>
                  <select
                    value={ruleForm.scope}
                    onChange={(event) =>
                      handleRuleScopeChange(event.target.value as CurriculumRuleInput['scope'])
                    }
                    disabled={ruleForm.rule_type !== 'elective'}
                  >
                    <option value="global">All main majors</option>
                    <option value="main_major">Selected main major</option>
                    <option value="child_major">Selected child major</option>
                  </select>
                </label>

                <button type="submit" disabled={saving || !ruleForm.course_id}>
                  Add rule
                </button>
              </form>

              <div className="workspace-table workspace-table--spaced">
                {(data?.curriculumRules ?? [])
                  .filter((rule) => rule.course_id === selectedCourseId)
                  .map((rule) => (
                    <div className="workspace-row workspace-row--four" key={rule.id}>
                      <span>
                        <strong>{ruleTypeLabels[rule.rule_type]}</strong>
                        <small>{data ? ruleScopeDetail(rule, data) : 'Scope'}</small>
                      </span>
                      <span>{scopeLabels[rule.scope]}</span>
                      <span>{coursesById.get(rule.course_id)?.code ?? 'Course'}</span>
                      <button
                        type="button"
                        className="workspace-danger-action"
                        onClick={() => void handleRuleDelete(rule.id)}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            </section>

            <section className="workspace-panel">
              <h2>{selectedOfferingId ? 'Edit offering' : 'Create offering'}</h2>
              <form className="workspace-form" onSubmit={(event) => void handleOfferingSubmit(event)}>
                <label>
                  <span>Catalog course</span>
                  <select
                    value={offeringForm.course_id}
                    onChange={(event) =>
                      setOfferingForm((current) => ({ ...current, course_id: event.target.value }))
                    }
                    required
                  >
                    <option value="">Choose course</option>
                    {(data?.courses ?? []).map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="workspace-form-grid">
                  <label>
                    <span>Term</span>
                    <select
                      value={offeringForm.term}
                      onChange={(event) =>
                        setOfferingForm((current) => ({
                          ...current,
                          term: event.target.value as CourseTerm,
                        }))
                      }
                    >
                      <option value="semester_1">Semester 1</option>
                      <option value="semester_2">Semester 2</option>
                      <option value="summer">Summer</option>
                    </select>
                  </label>

                  <label>
                    <span>Year</span>
                    <input
                      type="number"
                      value={offeringForm.academic_year}
                      onChange={(event) =>
                        setOfferingForm((current) => ({
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
                    value={offeringForm.status}
                    onChange={(event) =>
                      setOfferingForm((current) => ({
                        ...current,
                        status: event.target.value as CourseOfferingInput['status'],
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                {!selectedOfferingId && (
                  <label>
                    <span>First teacher</span>
                    <select
                      value={initialTeacherId}
                      onChange={(event) => setInitialTeacherId(event.target.value)}
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

                <button type="submit" disabled={saving || !offeringForm.course_id}>
                  {saving ? 'Saving...' : selectedOfferingId ? 'Save offering' : 'Create offering'}
                </button>

                {selectedOfferingId && (
                  <button
                    type="button"
                    className="workspace-danger-action workspace-danger-action--wide"
                    onClick={() => void handleDeleteOffering()}
                    disabled={saving}
                  >
                    Delete offering
                  </button>
                )}
              </form>
            </section>
          </aside>
        </div>
      )}
    </section>
  )
}

export default AdminCoursesPage
