import { useCallback, useEffect, useMemo, useState } from 'react'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import { SwinlearnKnowledgeIndexPanel } from '../../components/SwinlearnKnowledgeIndexPanel'
import {
  addCourseMember,
  approveCourseRegistrationRequest,
  courseLabel,
  createCourseOffering,
  deleteCourseOffering,
  fetchAdminCourseData,
  getErrorMessage,
  importCourseOfferingContent,
  indexSwinlearnCourses,
  profileName,
  rejectCourseRegistrationRequest,
  removeCourseMember,
  setTeachingAssistant,
  updateCourseOffering,
} from '../../lib/workspace/api'
import type {
  AdminCourseData,
  CourseMemberRole,
  CourseOfferingInput,
  CourseTerm,
  CourseWithMembers,
  ProfileRow,
} from '../../lib/workspace/types'
import {
  filterCourseOfferings,
  getCourseOfferAcademicYears,
  getCourseOfferMemberCounts,
  getEligibleTeachersForCourse,
  getPendingRegistrationRequestsForOffering,
  resolveCourseOfferSelection,
  type CourseOfferFilters,
} from './adminCourseOfferSelection'
import './AdminCourseOfferPage.css'

const currentYear = new Date().getFullYear()

const termLabels: Record<CourseTerm, string> = {
  semester_1: 'Semester 1',
  semester_2: 'Semester 2',
  summer: 'Summer',
}

const memberRoleLabel: Record<CourseMemberRole, string> = {
  teacher: 'Teacher',
  teaching_assistant: 'Teaching assistant',
  student: 'Student',
}

const emptyOfferingForm = (courseId = ''): CourseOfferingInput => ({
  course_id: courseId,
  term: 'semester_1',
  academic_year: currentYear,
  status: 'active',
})

const emptyFilters = (): CourseOfferFilters => ({
  query: '',
  status: 'all',
  term: 'all',
  academicYear: 'all',
})

const offeringToForm = (offering: CourseWithMembers): CourseOfferingInput => ({
  course_id: offering.catalog_course_id,
  term: offering.term,
  academic_year: offering.academic_year,
  status: offering.status,
})

const memberProfileName = (profilesById: Map<string, ProfileRow>, userId: string) =>
  profileName(profilesById.get(userId))

const toReadableDate = (isoValue: string) =>
  new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoValue))

function AdminCourseOfferPage() {
  const [data, setData] = useState<AdminCourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filters, setFilters] = useState<CourseOfferFilters>(emptyFilters)
  const [selectedOfferingId, setSelectedOfferingId] = useState('')
  const [offeringForm, setOfferingForm] = useState<CourseOfferingInput>(emptyOfferingForm())
  const [initialTeacherId, setInitialTeacherId] = useState('')
  const [teacherToAdd, setTeacherToAdd] = useState('')
  const [assistantToSet, setAssistantToSet] = useState<string | null>(null)
  const [studentToAdd, setStudentToAdd] = useState('')
  const [contentImportFile, setContentImportFile] = useState<File | null>(null)
  const [offeringDialogOpen, setOfferingDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const nextData = await fetchAdminCourseData()

      setData(nextData)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Course offer data could not be loaded'))
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

    for (const profile of data?.profiles ?? []) {
      map.set(profile.id, profile)
    }

    return map
  }, [data?.profiles])

  const students = (data?.profiles ?? []).filter(
    (profile) => profile.role === 'student' && profile.status === 'active',
  )
  const academicYears = getCourseOfferAcademicYears(data?.offerings ?? [])
  const visibleOfferings = useMemo(
    () => filterCourseOfferings(data?.offerings ?? [], filters),
    [data?.offerings, filters],
  )
  const resolvedSelectedOfferingId = useMemo(() => {
    if (offeringDialogOpen && selectedOfferingId === '') {
      return ''
    }

    return resolveCourseOfferSelection({
      offerings: visibleOfferings,
      selectedOfferingId,
    })
  }, [offeringDialogOpen, selectedOfferingId, visibleOfferings])
  const selectedOffering = resolvedSelectedOfferingId
    ? visibleOfferings.find((offering) => offering.id === resolvedSelectedOfferingId) ?? null
    : null
  const selectedAssistantId =
    selectedOffering?.members.find((member) => member.role === 'teaching_assistant')?.user_id ?? ''
  const selectedMemberCounts = selectedOffering
    ? getCourseOfferMemberCounts(selectedOffering)
    : null
  const selectedContentPackage = selectedOffering
    ? data?.contentPackages.find((contentPackage) => contentPackage.offering_id === selectedOffering.id) ?? null
    : null
  const selectedKnowledgeIndex = selectedOffering
    ? data?.knowledgeIndexes?.[selectedOffering.id] ?? { status: 'missing' }
    : null
  const pendingRegistrationRequests = selectedOffering
    ? getPendingRegistrationRequestsForOffering(data?.registrationRequests ?? [], selectedOffering.id)
    : []
  const initialTeacherOptions = useMemo(
    () =>
      data && offeringForm.course_id
        ? getEligibleTeachersForCourse({
            profiles: data.profiles,
            courseId: offeringForm.course_id,
            mainMajors: data.mainMajors,
            childMajors: data.childMajors,
            curriculumRules: data.curriculumRules,
          })
        : [],
    [data, offeringForm.course_id],
  )
  const selectedTeachingOptions =
    data && selectedOffering
      ? getEligibleTeachersForCourse({
          profiles: data.profiles,
          courseId: selectedOffering.catalog_course_id,
          mainMajors: data.mainMajors,
          childMajors: data.childMajors,
          curriculumRules: data.curriculumRules,
        })
      : []
  const activeOfferingCount = (data?.offerings ?? []).filter((offering) => offering.status === 'active').length
  const archivedOfferingCount = (data?.offerings ?? []).filter((offering) => offering.status === 'archived').length
  const initialTeacherSelectValue =
    initialTeacherId && initialTeacherOptions.some((teacher) => teacher.id === initialTeacherId)
      ? initialTeacherId
      : initialTeacherOptions[0]?.id ?? ''
  const teacherToAddSelectValue =
    teacherToAdd && selectedTeachingOptions.some((teacher) => teacher.id === teacherToAdd)
      ? teacherToAdd
      : ''
  const assistantSelectValue =
    assistantToSet ??
    (selectedAssistantId && selectedTeachingOptions.some((teacher) => teacher.id === selectedAssistantId)
      ? selectedAssistantId
      : '')

  const openNewOfferingDialog = () => {
    setOfferingForm(emptyOfferingForm(data?.courses[0]?.id ?? ''))
    setInitialTeacherId('')
    setSelectedOfferingId('')
    setAssistantToSet(null)
    setTeacherToAdd('')
    setStudentToAdd('')
    setError('')
    setNotice('')
    setOfferingDialogOpen(true)
  }

  const openEditOfferingDialog = (offering: CourseWithMembers) => {
    setSelectedOfferingId(offering.id)
    setOfferingForm(offeringToForm(offering))
    setAssistantToSet(null)
    setError('')
    setNotice('')
    setOfferingDialogOpen(true)
  }

  const closeOfferingDialog = () => {
    setOfferingDialogOpen(false)
  }

  const handleOfferingSelect = (offering: CourseWithMembers) => {
    setSelectedOfferingId(offering.id)
    setAssistantToSet(null)
    setTeacherToAdd('')
    setStudentToAdd('')
    setContentImportFile(null)
    setNotice('')
    setError('')
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
        const nextOfferingId = await createCourseOffering(offeringForm, initialTeacherSelectValue)

        setSelectedOfferingId(nextOfferingId)
        setNotice('Course offering created.')
      }

      setOfferingDialogOpen(false)
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
      setOfferingDialogOpen(false)
      setOfferingForm(emptyOfferingForm(data?.courses[0]?.id ?? ''))
      setNotice('Course offering deleted.')
      await loadData()
    } catch (offeringError) {
      setError(getErrorMessage(offeringError, 'Course offering could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  const handleContentImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedOffering || !contentImportFile) {
      setError('Choose a Canvas course export ZIP first.')
      return
    }

    const form = event.currentTarget

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await importCourseOfferingContent(selectedOffering.id, contentImportFile)

      form.reset()
      setContentImportFile(null)
      setNotice(`Imported ${result.module_count} modules and ${result.item_count} items.`)
      await loadData()
    } catch (importError) {
      setError(getErrorMessage(importError, 'Course content could not be imported'))
    } finally {
      setSaving(false)
    }
  }

  const handleIndexKnowledge = async () => {
    if (!selectedOffering) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await indexSwinlearnCourses([selectedOffering.id])
      setNotice('Course knowledge indexed for SWINLEARN retrieval.')
      await loadData()
    } catch (indexError) {
      setError(getErrorMessage(indexError, 'Course knowledge could not be indexed'))
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
      if (role === 'teacher') {
        setTeacherToAdd('')
      }
      if (role === 'student') {
        setStudentToAdd('')
      }
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
      await setTeachingAssistant(selectedOffering.id, assistantSelectValue || null)
      setAssistantToSet(null)
      setNotice(assistantSelectValue ? 'Teaching assistant updated.' : 'Teaching assistant removed.')
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
      setAssistantToSet(null)
      setNotice('Member removed.')
      await loadData()
    } catch (removeError) {
      setError(getErrorMessage(removeError, 'Member could not be removed'))
    } finally {
      setSaving(false)
    }
  }

  const handleApproveRegistrationRequest = async (requestId: string) => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await approveCourseRegistrationRequest(requestId)
      setNotice('Student access confirmed.')
      await loadData()
    } catch (approvalError) {
      setError(getErrorMessage(approvalError, 'Registration request could not be approved'))
    } finally {
      setSaving(false)
    }
  }

  const handleRejectRegistrationRequest = async (requestId: string) => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await rejectCourseRegistrationRequest(requestId)
      setNotice('Registration request rejected.')
      await loadData()
    } catch (rejectionError) {
      setError(getErrorMessage(rejectionError, 'Registration request could not be rejected'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page admin-course-offer-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Admin workspace</span>
        <h1 className="workspace-page-title">Course Offer</h1>
        <p className="workspace-page-subtitle">
          Create semester course offerings, assign teaching teams, and manage student enrollment.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      {loading ? (
        <section className="workspace-panel">Loading course offers...</section>
      ) : (
        <div className="workspace-grid admin-course-offer-layout">
          <section className="workspace-panel admin-course-offer-list-panel">
            <div className="workspace-section-heading">
              <div>
                <h2>Offerings</h2>
                <p>{visibleOfferings.length} offerings match the current filters.</p>
              </div>
              <button
                type="button"
                className="workspace-secondary-action"
                onClick={openNewOfferingDialog}
              >
                New offering
              </button>
            </div>

            <div className="workspace-meta-row admin-course-offer-summary">
              <span className="workspace-chip">{data?.offerings.length ?? 0} total</span>
              <span className="workspace-chip">{activeOfferingCount} active</span>
              <span className="workspace-chip">{archivedOfferingCount} archived</span>
            </div>

            <div className="workspace-form admin-course-offer-filters">
              <label className="admin-course-offer-search">
                <span>Search</span>
                <input
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Search code, title, or description"
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as CourseOfferFilters['status'],
                    }))
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label>
                <span>Term</span>
                <select
                  value={filters.term}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      term: event.target.value as CourseOfferFilters['term'],
                    }))
                  }
                >
                  <option value="all">All terms</option>
                  <option value="semester_1">Semester 1</option>
                  <option value="semester_2">Semester 2</option>
                  <option value="summer">Summer</option>
                </select>
              </label>

              <label>
                <span>Year</span>
                <select
                  value={filters.academicYear}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, academicYear: event.target.value }))
                  }
                >
                  <option value="all">All years</option>
                  {academicYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-course-offer-table-scroll">
            <div className="workspace-table admin-course-offer-table" role="table" aria-label="Course offerings">
              <div className="admin-course-offer-table-header" role="row">
                <span>Course</span>
                <span>Term</span>
                <span>Status</span>
                <span>Roster</span>
                <span>Members</span>
              </div>
              {visibleOfferings.map((offering) => {
                const counts = getCourseOfferMemberCounts(offering)

                return (
                  <button
                    key={offering.id}
                    type="button"
                    className={`workspace-row workspace-row--button admin-course-offer-row${resolvedSelectedOfferingId === offering.id ? ' workspace-row--active' : ''}`}
                    onClick={() => handleOfferingSelect(offering)}
                  >
                    <span className="admin-course-offer-course">
                      <strong>{offering.code}</strong>
                      <small>{offering.title}</small>
                    </span>
                    <span className="admin-course-offer-column admin-course-offer-column--term">
                      {termLabels[offering.term]}
                      <small>{offering.academic_year}</small>
                    </span>
                    <span className="admin-course-offer-column admin-course-offer-column--status">
                      {offering.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                    <span className="admin-course-offer-column admin-course-offer-column--roster">
                      {counts.teacher} teachers
                      <small>{counts.student} students</small>
                    </span>
                    <span className="admin-course-offer-column admin-course-offer-column--members">
                      {counts.total} members
                    </span>
                  </button>
                )
              })}

              {visibleOfferings.length === 0 && (
                <div className="workspace-empty-state">No course offerings match these filters.</div>
              )}
            </div>
            </div>
          </section>

          <aside className="workspace-panel admin-course-offer-detail">
            {selectedOffering ? (
              <>
                <div className="workspace-section-heading">
                  <div>
                    <h2>{courseLabel(selectedOffering)}</h2>
                    <p>{selectedOffering.description || 'No course description provided.'}</p>
                  </div>
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    onClick={() => openEditOfferingDialog(selectedOffering)}
                  >
                    Edit offering
                  </button>
                </div>

                <div className="workspace-meta-row">
                  <span className="workspace-chip">{termLabels[selectedOffering.term]}</span>
                  <span className="workspace-chip">{selectedOffering.academic_year}</span>
                  <span className="workspace-chip">{selectedOffering.status}</span>
                  {selectedMemberCounts && (
                    <span className="workspace-chip">{selectedMemberCounts.total} members</span>
                  )}
                </div>

                <section className="admin-course-offer-member-section">
                  <h3>Course content</h3>
                  {selectedContentPackage ? (
                    <div className="workspace-subpanel">
                      <div className="workspace-section-heading">
                        <div>
                          <strong>{selectedContentPackage.source_title}</strong>
                          <p>
                            Imported {toReadableDate(selectedContentPackage.imported_at)}
                            {selectedContentPackage.original_file_name
                              ? ` from ${selectedContentPackage.original_file_name}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-chip">
                          {selectedContentPackage.module_count} modules
                        </span>
                        <span className="workspace-chip">
                          {selectedContentPackage.item_count} items
                        </span>
                        <span className="workspace-chip">
                          {selectedContentPackage.asset_count} files
                        </span>
                      </div>
                      {selectedKnowledgeIndex && (
                        <SwinlearnKnowledgeIndexPanel
                          hasContentPackage
                          knowledgeIndex={selectedKnowledgeIndex}
                          disabled={saving}
                          indexing={saving}
                          onIndex={() => void handleIndexKnowledge()}
                          subtitle="Re-index after replacing imported Canvas content so SWINLEARN retrieval stays current."
                        />
                      )}
                    </div>
                  ) : (
                    <div className="workspace-empty-state">
                      No course content package has been imported for this offering.
                    </div>
                  )}

                  <form className="workspace-form" onSubmit={(event) => void handleContentImport(event)}>
                    <label>
                      <span>Canvas course export ZIP</span>
                      <input
                        type="file"
                        accept=".zip,application/zip"
                        onChange={(event) => setContentImportFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button type="submit" disabled={saving || !contentImportFile}>
                      {saving
                        ? 'Importing...'
                        : selectedContentPackage
                          ? 'Replace imported content'
                          : 'Import course content'}
                    </button>
                  </form>
                </section>

                <section className="admin-course-offer-member-section">
                  <h3>Teaching team</h3>
                  <div className="workspace-member-list">
                    {selectedOffering.members
                      .filter((member) => member.role !== 'student')
                      .map((membership) => (
                        <div className="workspace-member" key={membership.id}>
                          <div>
                            <strong>{memberProfileName(profilesById, membership.user_id)}</strong>
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
                      ))}
                    {selectedOffering.members.filter((member) => member.role !== 'student').length === 0 && (
                      <div className="workspace-empty-state">No teaching team assigned.</div>
                    )}
                  </div>

                  <div className="workspace-form workspace-form--inline">
                    <label>
                      <span>Add teacher</span>
                      <select value={teacherToAddSelectValue} onChange={(event) => setTeacherToAdd(event.target.value)}>
                        <option value="">
                          {selectedTeachingOptions.length === 0 ? 'No eligible teachers' : 'Choose teacher'}
                        </option>
                        {selectedTeachingOptions.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {profileName(teacher)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleAddMember('teacher', teacherToAddSelectValue)}
                      disabled={saving || !teacherToAddSelectValue}
                    >
                      Add
                    </button>
                  </div>

                  <div className="workspace-form workspace-form--inline">
                    <label>
                      <span>Teaching assistant</span>
                      <select
                        value={assistantSelectValue}
                        onChange={(event) => setAssistantToSet(event.target.value)}
                      >
                        <option value="">No teaching assistant</option>
                        {selectedTeachingOptions.map((teacher) => (
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
                </section>

                <section className="admin-course-offer-member-section">
                  <h3>Registered students pending confirmation</h3>
                  <div className="workspace-member-list">
                    {pendingRegistrationRequests.map((registrationRequest) => (
                      <div className="workspace-member admin-registration-request" key={registrationRequest.id}>
                        <div>
                          <strong>{memberProfileName(profilesById, registrationRequest.user_id)}</strong>
                          <span>Pending approval</span>
                        </div>
                        <div className="admin-registration-request-actions">
                          <button
                            type="button"
                            className="workspace-primary-action"
                            onClick={() => void handleApproveRegistrationRequest(registrationRequest.id)}
                            disabled={saving}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="workspace-danger-action"
                            onClick={() => void handleRejectRegistrationRequest(registrationRequest.id)}
                            disabled={saving}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingRegistrationRequests.length === 0 && (
                      <div className="workspace-empty-state">No pending registration requests.</div>
                    )}
                  </div>
                </section>

                <section className="admin-course-offer-member-section">
                  <h3>Students</h3>
                  <div className="workspace-member-list">
                    {selectedOffering.members
                      .filter((member) => member.role === 'student')
                      .map((membership) => (
                        <div className="workspace-member" key={membership.id}>
                          <div>
                            <strong>{memberProfileName(profilesById, membership.user_id)}</strong>
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
                      ))}
                    {selectedOffering.members.filter((member) => member.role === 'student').length === 0 && (
                      <div className="workspace-empty-state">No students enrolled.</div>
                    )}
                  </div>

                  <div className="workspace-form workspace-form--inline">
                    <label>
                      <span>Emergency add student</span>
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
              </>
            ) : (
              <div className="workspace-empty-state">Select an offering to manage its roster.</div>
            )}
          </aside>

          {offeringDialogOpen && (
            <div className="workspace-modal-backdrop">
              <div
                className="workspace-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="course-offer-dialog-title"
              >
                <div className="workspace-modal-header">
                  <div>
                    <h2 id="course-offer-dialog-title">
                      {selectedOfferingId ? 'Edit offering' : 'Create offering'}
                    </h2>
                    <p>Create or update a semester/year course instance.</p>
                  </div>
                  <button
                    type="button"
                    className="workspace-modal-close"
                    onClick={closeOfferingDialog}
                  >
                    Close
                  </button>
                </div>

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
                        value={initialTeacherSelectValue}
                        onChange={(event) => setInitialTeacherId(event.target.value)}
                      >
                        <option value="">
                          {initialTeacherOptions.length === 0 ? 'No eligible teachers' : 'Choose teacher'}
                        </option>
                        {initialTeacherOptions.map((teacher) => (
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
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default AdminCourseOfferPage
