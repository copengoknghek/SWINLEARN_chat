import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthContext } from '../../../../context/AuthContext'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import type { Role } from '../../../../hooks/useAuth'
import {
  addStudentCourseCompletion,
  createAdminUser,
  downloadAdminUserImportTemplate,
  downloadUsersExport,
  fetchAdminUserData,
  fetchCatalog,
  getErrorMessage,
  importAdminUsersWorkbook,
  invokeAdminUserAction,
  orderedProfiles,
  profileName,
  removeStudentCourseCompletion,
  resetAdminUserPassword,
  updateProfile,
  updateStudentCourseCompletion,
} from '../../lib/workspace/api'
import { gradeFromScore, gradeLabel } from '../../lib/workspace/courseGrades'
import { buildStudentProgressForProfile } from '../../lib/workspace/studentProgressClient'
import type {
  AdminUserImportResult,
  ChildMajorRow,
  CourseCatalogRow,
  CurriculumRuleRow,
  MainMajorRow,
  ProfileCampus,
  ProfileRow,
  ProfileStatus,
  StudentCourseCompletionRow,
} from '../../lib/workspace/types'

type CreateUserForm = {
  fullName: string
  role: 'student' | 'teacher'
  campus: ProfileCampus
  userId: string
  mainMajorId: string
  childMajorId: string
}

type EditUserForm = {
  fullName: string
  displayName: string
  role: Role
  campus: ProfileCampus | ''
  studentId: string
  mainMajorId: string
  childMajorId: string
  status: ProfileStatus
}

type CredentialResult = {
  email: string
  tempPassword: string
  source: string
}

const campusLabels: Record<ProfileCampus, string> = {
  hanoi: 'Hanoi',
  danang: 'Da Nang',
  hcm: 'HCM',
}

const statusFilterLabels = {
  all: 'All statuses',
  active: 'Active',
  inactive: 'Not active',
} as const

const emptyCreateForm: CreateUserForm = {
  fullName: '',
  role: 'student',
  campus: 'hanoi',
  userId: '',
  mainMajorId: '',
  childMajorId: '',
}

const emptyEditForm: EditUserForm = {
  fullName: '',
  displayName: '',
  role: 'student',
  campus: '',
  studentId: '',
  mainMajorId: '',
  childMajorId: '',
  status: 'active',
}

function AdminUsersPage() {
  const { user } = useAuthContext()
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [mainMajors, setMainMajors] = useState<MainMajorRow[]>([])
  const [childMajors, setChildMajors] = useState<ChildMajorRow[]>([])
  const [courses, setCourses] = useState<CourseCatalogRow[]>([])
  const [curriculumRules, setCurriculumRules] = useState<CurriculumRuleRow[]>([])
  const [studentCompletions, setStudentCompletions] = useState<StudentCourseCompletionRow[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [sidePanel, setSidePanel] = useState<'create' | 'edit'>('create')
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm)
  const [editForm, setEditForm] = useState<EditUserForm>(emptyEditForm)
  const [courseToComplete, setCourseToComplete] = useState('')
  const [completionScoreToAdd, setCompletionScoreToAdd] = useState('50')
  const [completionScoreDrafts, setCompletionScoreDrafts] = useState<Record<string, string>>({})
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [campusFilter, setCampusFilter] = useState<ProfileCampus | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [credentials, setCredentials] = useState<CredentialResult[]>([])
  const [importResults, setImportResults] = useState<AdminUserImportResult[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProfiles = useCallback(async () => {
    try {
      const [userData, catalog] = await Promise.all([fetchAdminUserData(), fetchCatalog()])
      const nextProfiles = userData.profiles
      const nextSelectedProfile = selectedProfileId
        ? nextProfiles.find((profile) => profile.id === selectedProfileId) ?? null
        : null

      setProfiles(nextProfiles)
      setMainMajors(catalog.mainMajors)
      setChildMajors(userData.childMajors.length > 0 ? userData.childMajors : catalog.childMajors)
      setCourses(userData.courses)
      setCurriculumRules(userData.curriculumRules)
      setStudentCompletions(userData.studentCompletions)

      if (selectedProfileId && !nextSelectedProfile) {
        setSidePanel('create')
      }

      setSelectedProfileId(nextSelectedProfile?.id ?? '')
      setCourseToComplete((current) => current || userData.courses[0]?.id || '')

      if (nextSelectedProfile) {
        setEditForm({
          fullName: nextSelectedProfile.full_name ?? '',
          displayName: nextSelectedProfile.display_name ?? '',
          role: nextSelectedProfile.role,
          campus: nextSelectedProfile.campus ?? '',
          studentId: nextSelectedProfile.student_id ?? '',
          mainMajorId: nextSelectedProfile.main_major_id ?? '',
          childMajorId: nextSelectedProfile.child_major_id ?? '',
          status: nextSelectedProfile.status,
        })
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Users could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [selectedProfileId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadProfiles(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadProfiles])

  const ordered = useMemo(() => orderedProfiles(profiles), [profiles])
  const normalizedUserSearchQuery = userSearchQuery.trim().toLowerCase()
  const filteredProfiles = ordered.filter((profile) => {
    const roleMatches = roleFilter === 'all' || profile.role === roleFilter
    const campusMatches = campusFilter === 'all' || profile.campus === campusFilter
    const searchableProfileText = [
      profileName(profile),
      profile.full_name,
      profile.display_name,
      profile.email,
      profile.id,
      profile.student_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatches =
      normalizedUserSearchQuery === '' ||
      searchableProfileText.includes(normalizedUserSearchQuery)
    const statusMatches =
      statusFilter === 'all' ||
      (statusFilter === 'active'
        ? profile.status === 'active'
        : profile.status === 'inactive')

    return roleMatches && campusMatches && statusMatches && searchMatches
  })
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null
  const mainMajorsById = useMemo(() => {
    const map = new Map<string, MainMajorRow>()

    for (const mainMajor of mainMajors) {
      map.set(mainMajor.id, mainMajor)
    }

    return map
  }, [mainMajors])
  const childMajorsById = useMemo(() => {
    const map = new Map<string, ChildMajorRow>()

    for (const childMajor of childMajors) {
      map.set(childMajor.id, childMajor)
    }

    return map
  }, [childMajors])
  const coursesById = useMemo(() => {
    const map = new Map<string, CourseCatalogRow>()

    for (const course of courses) {
      map.set(course.id, course)
    }

    return map
  }, [courses])
  const selectedStudentCompletions = selectedProfile
    ? studentCompletions.filter((completion) => completion.student_id === selectedProfile.id)
    : []
  const selectedCompletedCourseIds = new Set(
    selectedStudentCompletions.map((completion) => completion.course_id),
  )
  const availableCompletionCourses = courses.filter(
    (course) => !selectedCompletedCourseIds.has(course.id),
  )
  const selectedStudentProgress = useMemo(() => {
    if (!selectedProfile || selectedProfile.role !== 'student') {
      return null
    }

    return buildStudentProgressForProfile({
      profile: selectedProfile,
      courses,
      curriculumRules,
      childMajors,
      completions: studentCompletions,
    })
  }, [selectedProfile, courses, curriculumRules, childMajors, studentCompletions])

  const roleCounts = useMemo(
    () => ({
      admin: profiles.filter((profile) => profile.role === 'admin').length,
      teacher: profiles.filter((profile) => profile.role === 'teacher').length,
      student: profiles.filter((profile) => profile.role === 'student').length,
    }),
    [profiles],
  )

  const profileMajorLabel = (profile: ProfileRow) => {
    if (profile.role === 'teacher') {
      return profile.main_major_id
        ? mainMajorsById.get(profile.main_major_id)?.title ?? 'Main major'
        : 'No main major'
    }

    if (profile.role === 'student') {
      return profile.child_major_id
        ? childMajorsById.get(profile.child_major_id)?.title ?? 'Child major'
        : 'No child major'
    }

    return 'No major'
  }

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    setImportResults([])

    try {
      const result = await createAdminUser({
        full_name: createForm.fullName.trim(),
        role: createForm.role,
        campus: createForm.campus,
        user_id: createForm.userId.trim().toUpperCase(),
        main_major_id: createForm.role === 'teacher' ? createForm.mainMajorId || null : null,
        child_major_id: createForm.role === 'student' ? createForm.childMajorId || null : null,
      })

      setCredentials((current) => [
        {
          email: result.email,
          tempPassword: result.temp_password,
          source: 'Created user',
        },
        ...current,
      ])
      setCreateForm(emptyCreateForm)
      setNotice('User account created. The temporary password is saved until the user changes it.')
      await loadProfiles()
    } catch (createError) {
      setError(getErrorMessage(createError, 'User account could not be created'))
    } finally {
      setSaving(false)
    }
  }

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    setImportResults([])

    try {
      const results = await importAdminUsersWorkbook(file)
      const successfulCredentials = results
        .filter((result) => result.success && result.temp_password)
        .map((result) => ({
          email: result.email,
          tempPassword: result.temp_password ?? '',
          source: `Excel row ${result.row}`,
        }))

      setImportResults(results)
      setCredentials((current) => [...successfulCredentials, ...current])
      setNotice(`${successfulCredentials.length} users imported. Temporary passwords are saved until users change them.`)
      await loadProfiles()
    } catch (importError) {
      setError(getErrorMessage(importError, 'Excel users could not be imported'))
    } finally {
      setSaving(false)
      event.target.value = ''
    }
  }

  const handleDownloadTemplate = async () => {
    setError('')
    setNotice('')

    try {
      await downloadAdminUserImportTemplate()
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, 'Import template could not be downloaded'))
    }
  }

  const handleExportUsers = async (includeCredentials: boolean) => {
    const exportIds = filteredProfiles.map((profile) => profile.id)

    if (exportIds.length === 0) {
      setNotice('')
      setError('No users match the current filters to export.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await downloadUsersExport(exportIds, includeCredentials)
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, 'User export could not be downloaded'))
    } finally {
      setSaving(false)
    }
  }

  const handleShowCreatePanel = () => {
    setSidePanel('create')
    setSelectedProfileId('')
  }

  const handleSelectProfile = (profile: ProfileRow) => {
    setSidePanel('edit')
    setSelectedProfileId(profile.id)
    setEditForm({
      fullName: profile.full_name ?? '',
      displayName: profile.display_name ?? '',
      role: profile.role,
      campus: profile.campus ?? '',
      studentId: profile.student_id ?? '',
      mainMajorId: profile.main_major_id ?? '',
      childMajorId: profile.child_major_id ?? '',
      status: profile.status,
    })
  }

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedProfile) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await updateProfile(selectedProfile.id, {
        full_name: editForm.fullName.trim(),
        display_name: editForm.displayName.trim(),
        role: editForm.role,
        campus: editForm.campus || null,
        student_id: editForm.role === 'admin' ? null : editForm.studentId.trim().toUpperCase() || null,
        main_major_id: editForm.role === 'teacher' ? editForm.mainMajorId || null : null,
        child_major_id: editForm.role === 'student' ? editForm.childMajorId || null : null,
      })

      setNotice('User profile updated.')
      await loadProfiles()
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'User profile could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!selectedProfile) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await resetAdminUserPassword(selectedProfile.id)
      setCredentials((current) => [
        {
          email: result.email,
          tempPassword: result.temp_password,
          source: 'Password reset',
        },
        ...current,
      ])
      setNotice('Password reset. The user must change it on next login.')
      await loadProfiles()
    } catch (resetError) {
      setError(getErrorMessage(resetError, 'Password could not be reset'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddCompletion = async () => {
    if (!selectedProfile || selectedProfile.role !== 'student' || !courseToComplete) {
      return
    }

    const finalScore = Number(completionScoreToAdd)

    if (!Number.isInteger(finalScore) || finalScore < 0 || finalScore > 100) {
      setError('Final score must be an integer from 0 to 100.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await addStudentCourseCompletion(selectedProfile.id, courseToComplete, finalScore)
      setCourseToComplete('')
      setCompletionScoreToAdd('50')
      setNotice('Completed course added.')
      await loadProfiles()
    } catch (completionError) {
      setError(getErrorMessage(completionError, 'Completed course could not be added'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCompletionScore = async (completionId: string) => {
    const draft = completionScoreDrafts[completionId]

    if (draft === undefined) {
      return
    }

    const finalScore = Number(draft)

    if (!Number.isInteger(finalScore) || finalScore < 0 || finalScore > 100) {
      setError('Final score must be an integer from 0 to 100.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await updateStudentCourseCompletion(completionId, finalScore)
      setCompletionScoreDrafts((current) => {
        const next = { ...current }
        delete next[completionId]
        return next
      })
      setNotice('Completion score updated.')
      await loadProfiles()
    } catch (completionError) {
      setError(getErrorMessage(completionError, 'Completion score could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveCompletion = async (completionId: string) => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await removeStudentCourseCompletion(completionId)
      setNotice('Completed course removed.')
      await loadProfiles()
    } catch (completionError) {
      setError(getErrorMessage(completionError, 'Completed course could not be removed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedProfile) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await invokeAdminUserAction({
        action: 'delete',
        userId: selectedProfile.id,
      })

      setSelectedProfileId('')
      setSidePanel('create')
      setNotice('User account deleted.')
      await loadProfiles()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'User account could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Admin workspace</span>
        <h1 className="workspace-page-title">User management</h1>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      <div className="workspace-grid workspace-grid--three admin-users-stats-grid">
        <article className="workspace-card admin-users-stats-card">
          Admins {roleCounts.admin}
        </article>
        <article className="workspace-card admin-users-stats-card">
          Teachers {roleCounts.teacher}
        </article>
        <article className="workspace-card admin-users-stats-card">
          Students {roleCounts.student}
        </article>
      </div>

      {credentials.length > 0 && (
        <section className="workspace-panel">
          <div className="workspace-section-heading">
            <div>
              <h2>Recently issued temporary passwords</h2>
              <p>These also appear in All users until each user changes their password.</p>
            </div>
            <button
              type="button"
              className="workspace-secondary-action"
              onClick={() => setCredentials([])}
            >
              Clear list
            </button>
          </div>
          <div className="workspace-table">
            {credentials.map((credential) => (
              <div className="workspace-row workspace-row--four" key={`${credential.email}-${credential.tempPassword}`}>
                <span>
                  <strong>{credential.email}</strong>
                  <small>{credential.source}</small>
                </span>
                <code>{credential.tempPassword}</code>
                <span>Must change on login</span>
                <button
                  type="button"
                  className="workspace-secondary-action"
                  onClick={() => void navigator.clipboard.writeText(credential.tempPassword)}
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {importResults.length > 0 && (
        <section className="workspace-panel">
          <h2>Excel import results</h2>
          <div className="workspace-table">
            {importResults.map((result) => (
              <div className="workspace-row workspace-row--four" key={`${result.row}-${result.email}`}>
                <span>
                  <strong>Row {result.row}</strong>
                  <small>{result.email || 'No generated email'}</small>
                </span>
                <span>{result.success ? 'Created' : 'Failed'}</span>
                <span>{result.error ?? result.user_id ?? ''}</span>
                <span>{result.temp_password ?? ''}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <section className="workspace-panel">Loading users...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-panel admin-users-list-panel">
            <div className="workspace-section-heading">
              <div>
                <h2>All users</h2>
                <p>{filteredProfiles.length} of {profiles.length} profiles shown.</p>
              </div>
            </div>

            <div className="admin-users-filter-toolbar" aria-label="User filters">
              <label className="admin-users-search">
                <span>Search</span>
                <input
                  type="search"
                  placeholder="Search name or ID"
                  value={userSearchQuery}
                  onChange={(event) => setUserSearchQuery(event.target.value)}
                  aria-label="Search users by name or ID"
                />
              </label>
              <details className="admin-users-filter-dropdown" aria-label="Role filter">
                <summary className="admin-users-filter-summary">
                  <span>Role</span>
                  <strong>{roleFilter === 'all' ? 'All roles' : roleFilter}</strong>
                </summary>
                <div className="admin-users-filter-menu">
                  {(['all', 'admin', 'teacher', 'student'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`workspace-tab${roleFilter === role ? ' workspace-tab--active' : ''}`}
                      onClick={(event) => {
                        setRoleFilter(role)
                        event.currentTarget.closest('details')?.removeAttribute('open')
                      }}
                    >
                      {role === 'all' ? 'All roles' : role}
                    </button>
                  ))}
                </div>
              </details>
              <details className="admin-users-filter-dropdown" aria-label="Campus filter">
                <summary className="admin-users-filter-summary">
                  <span>Campus</span>
                  <strong>{campusFilter === 'all' ? 'All campuses' : campusLabels[campusFilter]}</strong>
                </summary>
                <div className="admin-users-filter-menu">
                  {(['all', 'hanoi', 'danang', 'hcm'] as const).map((campus) => (
                    <button
                      key={campus}
                      type="button"
                      className={`workspace-tab workspace-tab--quiet${campusFilter === campus ? ' workspace-tab--active' : ''}`}
                      onClick={(event) => {
                        setCampusFilter(campus)
                        event.currentTarget.closest('details')?.removeAttribute('open')
                      }}
                    >
                      {campus === 'all' ? 'All campuses' : campusLabels[campus]}
                    </button>
                  ))}
                </div>
              </details>
              <details className="admin-users-filter-dropdown" aria-label="Status filter">
                <summary className="admin-users-filter-summary">
                  <span>Status</span>
                  <strong>{statusFilterLabels[statusFilter]}</strong>
                </summary>
                <div className="admin-users-filter-menu">
                  {(['all', 'active', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`workspace-tab workspace-tab--quiet${statusFilter === status ? ' workspace-tab--active' : ''}`}
                      onClick={(event) => {
                        setStatusFilter(status)
                        event.currentTarget.closest('details')?.removeAttribute('open')
                      }}
                    >
                      {statusFilterLabels[status]}
                    </button>
                  ))}
                </div>
              </details>
            </div>

            <div className="admin-users-table-scroll">
            <div className="workspace-table admin-users-table" role="table" aria-label="Users">
              <div className="admin-users-table-header" role="row">
                <span>User</span>
                <span>User ID</span>
                <span>Role</span>
                <span>Campus</span>
                <span>Status</span>
              </div>
              {filteredProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`workspace-row workspace-row--button admin-users-row${selectedProfileId === profile.id ? ' workspace-row--active' : ''}`}
                    onClick={() => handleSelectProfile(profile)}
                  >
                    <span className="admin-users-user">
                      <strong>{profileName(profile)}</strong>
                      <small>{profile.email}</small>
                    </span>
                    <span className="admin-users-column admin-users-column--userid">
                      {profile.student_id ?? '—'}
                    </span>
                    <span className="admin-users-column admin-users-column--role">{profile.role}</span>
                    <span className="admin-users-column admin-users-column--campus">
                      {profile.campus ? campusLabels[profile.campus] : 'No campus'}
                      <small>{profileMajorLabel(profile)}</small>
                    </span>
                    <span className="admin-users-column admin-users-column--status">
                      {profile.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                ))}
            </div>
            </div>

            <div className="workspace-section-heading admin-users-export-actions">
              <div>
                <h3>Export users</h3>
                <p>Download the users currently shown by your filters.</p>
              </div>
              <div className="workspace-inline-actions">
                <button
                  type="button"
                  className="workspace-secondary-action"
                  disabled={saving}
                  onClick={() => void handleExportUsers(false)}
                >
                  Export pending password users
                </button>
                <button
                  type="button"
                  className="workspace-secondary-action"
                  disabled={saving}
                  onClick={() => void handleExportUsers(true)}
                >
                  Export pending credentials
                </button>
              </div>
            </div>
          </section>

          <aside className="workspace-grid admin-users-side-panel">
            {sidePanel === 'create' ? (
            <section className="workspace-panel">
              <h2>Create user</h2>
              <form className="workspace-form" onSubmit={(event) => void handleCreateUser(event)}>
                <label>
                  <span>Full name</span>
                  <input
                    value={createForm.fullName}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, fullName: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>User ID</span>
                  <input
                    value={createForm.userId}
                    placeholder="SWD00015"
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, userId: event.target.value }))
                    }
                    required
                  />
                </label>
                <div className="workspace-form-grid">
                  <label>
                    <span>Role</span>
                    <select
                      value={createForm.role}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          role: event.target.value as CreateUserForm['role'],
                          mainMajorId: event.target.value === 'teacher' ? current.mainMajorId : '',
                          childMajorId: event.target.value === 'student' ? current.childMajorId : '',
                        }))
                      }
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </label>
                  <label>
                    <span>Campus</span>
                    <select
                      value={createForm.campus}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          campus: event.target.value as ProfileCampus,
                        }))
                      }
                    >
                      <option value="hanoi">Hanoi</option>
                      <option value="danang">Da Nang</option>
                      <option value="hcm">HCM</option>
                    </select>
                  </label>
                </div>
                {createForm.role === 'teacher' && (
                  <label>
                    <span>Main major</span>
                    <select
                      value={createForm.mainMajorId}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          mainMajorId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Choose main major</option>
                      {mainMajors.map((mainMajor) => (
                        <option key={mainMajor.id} value={mainMajor.id}>
                          {mainMajor.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {createForm.role === 'student' && (
                  <label>
                    <span>Child major</span>
                    <select
                      value={createForm.childMajorId}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          childMajorId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Choose child major</option>
                      {childMajors.map((childMajor) => (
                        <option key={childMajor.id} value={childMajor.id}>
                          {childMajor.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create account'}
                </button>
              </form>

              <div className="admin-users-side-divider" aria-hidden="true" />

              <h2>Excel import</h2>
              <p>
                Upload columns: Full name, User ID, Role, Campus, Major, and optional Status.
                Major uses the readable major title for teachers or students.
              </p>
              <form className="workspace-form">
                <div className="workspace-inline-actions">
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    disabled={saving}
                    onClick={() => void handleDownloadTemplate()}
                  >
                    Download template
                  </button>
                </div>
                <label>
                  <span>Excel file</span>
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => void handleExcelImport(event)}
                  />
                </label>
              </form>
            </section>
            ) : selectedProfile ? (
            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>Edit user</h2>
                  <p>{profileName(selectedProfile)}</p>
                </div>
                <button
                  type="button"
                  className="workspace-secondary-action"
                  onClick={handleShowCreatePanel}
                >
                  Create user
                </button>
              </div>
                  <form className="workspace-form" onSubmit={(event) => void handleUpdateUser(event)}>
                    <label>
                      <span>Full name</span>
                      <input
                        value={editForm.fullName}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, fullName: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <span>Display name</span>
                      <input
                        value={editForm.displayName}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, displayName: event.target.value }))
                        }
                      />
                    </label>
                    <div className="workspace-form-grid">
                      <label>
                        <span>Role</span>
                        <select
                          value={editForm.role}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              role: event.target.value as Role,
                              mainMajorId: event.target.value === 'teacher' ? current.mainMajorId : '',
                              childMajorId: event.target.value === 'student' ? current.childMajorId : '',
                            }))
                          }
                        >
                          {selectedProfile.role === 'admin' && <option value="admin">Admin</option>}
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                        </select>
                      </label>
                      <label>
                        <span>Campus</span>
                        <select
                          value={editForm.campus}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              campus: event.target.value as ProfileCampus | '',
                            }))
                          }
                        >
                          <option value="">No campus</option>
                          <option value="hanoi">Hanoi</option>
                          <option value="danang">Da Nang</option>
                          <option value="hcm">HCM</option>
                        </select>
                      </label>
                    </div>
                  {editForm.role !== 'admin' && (
                    <label>
                      <span>User ID</span>
                      <input
                        value={editForm.studentId}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            studentId: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  {editForm.role === 'teacher' && (
                    <label>
                      <span>Main major</span>
                      <select
                        value={editForm.mainMajorId}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            mainMajorId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Choose main major</option>
                        {mainMajors.map((mainMajor) => (
                          <option key={mainMajor.id} value={mainMajor.id}>
                            {mainMajor.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {editForm.role === 'student' && (
                    <label>
                      <span>Child major</span>
                      <select
                        value={editForm.childMajorId}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            childMajorId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Choose child major</option>
                        {childMajors.map((childMajor) => (
                          <option key={childMajor.id} value={childMajor.id}>
                            {childMajor.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    <span>Status</span>
                    <span className="admin-users-readonly-status">
                      {selectedProfile.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                  <div className="workspace-form-actions workspace-form-actions--three">
                    <button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save profile'}
                    </button>
                    <button type="button" onClick={() => void handleResetPassword()} disabled={saving}>
                      Reset password
                    </button>
                    <button
                      type="button"
                      className="workspace-danger-action workspace-danger-action--wide"
                      onClick={() => void handleDeleteUser()}
                      disabled={saving || selectedProfile.id === user?.id}
                    >
                      Delete auth user
                    </button>
                  </div>
                  </form>

                  {selectedProfile.role === 'student' && (
                    <div className="workspace-grid">
                      <div className="workspace-section-heading">
                        <div>
                          <h3>Completed courses</h3>
                          <p>Passed courses count toward prerequisites and completed credit points.</p>
                        </div>
                        {selectedStudentProgress && (
                          <span className="workspace-chip">
                            Total credit: {selectedStudentProgress.total_credit_points}
                          </span>
                        )}
                      </div>

                      <div className="workspace-table">
                        {selectedStudentCompletions.map((completion) => {
                          const course = coursesById.get(completion.course_id)
                          const progressRow = selectedStudentProgress?.completed_courses.find(
                            (row) => row.id === completion.id,
                          )
                          const grade = gradeFromScore(completion.final_score)
                          const scoreDraft = completionScoreDrafts[completion.id]
                          const scoreValue =
                            scoreDraft === undefined ? String(completion.final_score) : scoreDraft
                          const scoreDirty =
                            scoreDraft !== undefined && Number(scoreDraft) !== completion.final_score

                          return (
                            <div className="workspace-row admin-completion-row" key={completion.id}>
                              <span>
                                <strong>{course?.code ?? 'Course'}</strong>
                                <small>{course?.title ?? 'Completed course'}</small>
                              </span>
                              <label className="admin-completion-score-field">
                                <span className="sr-only">Final score</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={scoreValue}
                                  disabled={saving}
                                  onChange={(event) =>
                                    setCompletionScoreDrafts((current) => ({
                                      ...current,
                                      [completion.id]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <span className="workspace-chip admin-completion-grade">
                                {grade ? `${grade} · ${gradeLabel(grade)}` : '—'}
                              </span>
                              <span>
                                {progressRow?.counts_toward_total
                                  ? `${course?.credit_points ?? 0} credit points`
                                  : '—'}
                              </span>
                              <div className="admin-completion-actions">
                                {scoreDirty && (
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateCompletionScore(completion.id)}
                                    disabled={saving}
                                  >
                                    Save score
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="workspace-danger-action"
                                  onClick={() => void handleRemoveCompletion(completion.id)}
                                  disabled={saving}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {selectedStudentCompletions.length === 0 && (
                          <div className="workspace-empty-state">No completed courses recorded.</div>
                        )}
                      </div>

                      <div className="workspace-form workspace-form--inline">
                        <label>
                          <span>Add completed course</span>
                          <select
                            value={courseToComplete}
                            onChange={(event) => setCourseToComplete(event.target.value)}
                          >
                            <option value="">Choose course</option>
                            {availableCompletionCourses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.code} - {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Final score (0–100)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={completionScoreToAdd}
                            onChange={(event) => setCompletionScoreToAdd(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleAddCompletion()}
                          disabled={saving || !courseToComplete}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
            </section>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  )
}

export default AdminUsersPage
