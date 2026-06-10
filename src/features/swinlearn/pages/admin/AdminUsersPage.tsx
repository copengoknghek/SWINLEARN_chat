import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import {
  createAdminUser,
  fetchCatalog,
  fetchManagedUserCredentials,
  fetchProfiles,
  getErrorMessage,
  importAdminUsers,
  invokeAdminUserAction,
  orderedProfiles,
  profileName,
  resetAdminUserPassword,
  updateProfile,
} from '../../lib/workspace/api'
import type {
  AdminUserCreateInput,
  AdminUserImportResult,
  ChildMajorRow,
  ManagedUserCredentialRow,
  ProfileCampus,
  ProfileRow,
  ProfileStatus,
} from '../../lib/workspace/types'

type CreateUserForm = {
  fullName: string
  role: 'student' | 'teacher'
  campus: ProfileCampus
  userId: string
  childMajorId: string
}

type EditUserForm = {
  fullName: string
  displayName: string
  role: Role
  campus: ProfileCampus | ''
  studentId: string
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

const emptyCreateForm: CreateUserForm = {
  fullName: '',
  role: 'student',
  campus: 'hanoi',
  userId: '',
  childMajorId: '',
}

const emptyEditForm: EditUserForm = {
  fullName: '',
  displayName: '',
  role: 'student',
  campus: '',
  studentId: '',
  childMajorId: '',
  status: 'active',
}

const isProfileCampus = (value: string): value is ProfileCampus =>
  value === 'hanoi' || value === 'danang' || value === 'hcm'

const isCreatableRole = (value: string): value is CreateUserForm['role'] =>
  value === 'student' || value === 'teacher'

const normalizeCampus = (value: string): ProfileCampus => {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (normalized === 'da_nang') {
    return 'danang'
  }

  if (normalized === 'ho_chi_minh' || normalized === 'hcmc') {
    return 'hcm'
  }

  return isProfileCampus(normalized) ? normalized : 'hanoi'
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_')

const parseCsv = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (character === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1
      }

      row.push(cell.trim())
      cell = ''

      if (row.some((value) => value !== '')) {
        rows.push(row)
      }

      row = []
      continue
    }

    cell += character
  }

  row.push(cell.trim())

  if (row.some((value) => value !== '')) {
    rows.push(row)
  }

  return rows
}

const csvRowsToUsers = (text: string): AdminUserCreateInput[] => {
  const rows = parseCsv(text)
  const [headerRow, ...dataRows] = rows

  if (!headerRow || dataRows.length === 0) {
    return []
  }

  const headerMap = new Map(headerRow.map((header, index) => [normalizeHeader(header), index]))
  const valueFor = (row: string[], names: string[]) => {
    for (const name of names) {
      const index = headerMap.get(name)

      if (index !== undefined) {
        return row[index]?.trim() ?? ''
      }
    }

    return ''
  }

  return dataRows
    .map((row) => {
      const roleValue = valueFor(row, ['role']).toLowerCase()
      const campusValue = valueFor(row, ['campus'])
      const role = isCreatableRole(roleValue) ? roleValue : 'student'

      return {
        full_name: valueFor(row, ['full_name', 'name']),
        role,
        campus: normalizeCampus(campusValue),
        user_id: valueFor(row, ['user_id', 'userid', 'student_id', 'studentid', 'student_number']),
        child_major_id: valueFor(row, ['child_major_id', 'child_major', 'major_id']) || null,
      }
    })
    .filter((record) => record.full_name !== '' && record.user_id !== '')
}

function AdminUsersPage() {
  const { user } = useAuthContext()
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [childMajors, setChildMajors] = useState<ChildMajorRow[]>([])
  const [storedCredentials, setStoredCredentials] = useState<ManagedUserCredentialRow[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm)
  const [editForm, setEditForm] = useState<EditUserForm>(emptyEditForm)
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [campusFilter, setCampusFilter] = useState<ProfileCampus | 'all'>('all')
  const [credentials, setCredentials] = useState<CredentialResult[]>([])
  const [importResults, setImportResults] = useState<AdminUserImportResult[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProfiles = useCallback(async () => {
    try {
      const [nextProfiles, nextCredentials] = await Promise.all([
        fetchProfiles(),
        fetchManagedUserCredentials(),
      ])
      const catalog = await fetchCatalog()
      const nextSelectedProfile =
        nextProfiles.find((profile) => profile.id === selectedProfileId) ?? nextProfiles[0] ?? null

      setProfiles(nextProfiles)
      setChildMajors(catalog.childMajors)
      setStoredCredentials(nextCredentials)
      setSelectedProfileId(nextSelectedProfile?.id ?? '')

      if (nextSelectedProfile) {
        setEditForm({
          fullName: nextSelectedProfile.full_name ?? '',
          displayName: nextSelectedProfile.display_name ?? '',
          role: nextSelectedProfile.role,
          campus: nextSelectedProfile.campus ?? '',
          studentId: nextSelectedProfile.student_id ?? '',
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
  const filteredProfiles = ordered.filter((profile) => {
    const roleMatches = roleFilter === 'all' || profile.role === roleFilter
    const campusMatches = campusFilter === 'all' || profile.campus === campusFilter

    return roleMatches && campusMatches
  })
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null
  const credentialsByUserId = useMemo(() => {
    const map = new Map<string, ManagedUserCredentialRow>()

    for (const credential of storedCredentials) {
      map.set(credential.user_id, credential)
    }

    return map
  }, [storedCredentials])

  const roleCounts = useMemo(
    () => ({
      admin: profiles.filter((profile) => profile.role === 'admin').length,
      teacher: profiles.filter((profile) => profile.role === 'teacher').length,
      student: profiles.filter((profile) => profile.role === 'student').length,
    }),
    [profiles],
  )

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

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    setImportResults([])

    try {
      const text = await file.text()
      const records = csvRowsToUsers(text)

      if (records.length === 0) {
        throw new Error('CSV must include full_name or name, role, campus, and user_id columns.')
      }

      const results = await importAdminUsers(records)
      const successfulCredentials = results
        .filter((result) => result.success && result.temp_password)
        .map((result) => ({
          email: result.email,
          tempPassword: result.temp_password ?? '',
          source: `CSV row ${result.row}`,
        }))

      setImportResults(results)
      setCredentials((current) => [...successfulCredentials, ...current])
      setNotice(`${successfulCredentials.length} users imported. Temporary passwords are saved until users change them.`)
      await loadProfiles()
    } catch (importError) {
      setError(getErrorMessage(importError, 'CSV users could not be imported'))
    } finally {
      setSaving(false)
      event.target.value = ''
    }
  }

  const handleSelectProfile = (profile: ProfileRow) => {
    setSelectedProfileId(profile.id)
    setEditForm({
      fullName: profile.full_name ?? '',
      displayName: profile.display_name ?? '',
      role: profile.role,
      campus: profile.campus ?? '',
      studentId: profile.student_id ?? '',
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
        child_major_id: editForm.role === 'student' ? editForm.childMajorId || null : null,
        status: editForm.status,
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
        <p className="workspace-page-subtitle">
          Create teachers and students without opening the Supabase dashboard,
          import CSV users, issue temporary passwords, and reset access when needed.
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      <div className="workspace-grid workspace-grid--three">
        <article className="workspace-card">
          <span className="workspace-chip">Admins</span>
          <h2>{roleCounts.admin}</h2>
        </article>
        <article className="workspace-card">
          <span className="workspace-chip">Teachers</span>
          <h2>{roleCounts.teacher}</h2>
        </article>
        <article className="workspace-card">
          <span className="workspace-chip">Students</span>
          <h2>{roleCounts.student}</h2>
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
          <h2>CSV import results</h2>
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
          <section className="workspace-panel">
            <div className="workspace-section-heading">
              <div>
                <h2>All users</h2>
                <p>{filteredProfiles.length} of {profiles.length} profiles shown.</p>
              </div>
            </div>

            <div className="workspace-toolbar" aria-label="User filters">
              {(['all', 'admin', 'teacher', 'student'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`workspace-tab${roleFilter === role ? ' workspace-tab--active' : ''}`}
                  onClick={() => setRoleFilter(role)}
                >
                  {role === 'all' ? 'All roles' : role}
                </button>
              ))}
              {(['all', 'hanoi', 'danang', 'hcm'] as const).map((campus) => (
                <button
                  key={campus}
                  type="button"
                  className={`workspace-tab workspace-tab--quiet${campusFilter === campus ? ' workspace-tab--active' : ''}`}
                  onClick={() => setCampusFilter(campus)}
                >
                  {campus === 'all' ? 'All campuses' : campusLabels[campus]}
                </button>
              ))}
            </div>

            <div className="workspace-table workspace-table--spaced" role="table" aria-label="Users">
              {filteredProfiles.map((profile) => {
                const activeCredential = credentialsByUserId.get(profile.id)
                const visiblePassword =
                  profile.must_change_password && activeCredential
                    ? activeCredential.temp_password
                    : ''

                return (
                  <button
                    key={profile.id}
                    type="button"
                    className={`workspace-row workspace-row--button workspace-row--four${selectedProfileId === profile.id ? ' workspace-row--active' : ''}`}
                    onClick={() => handleSelectProfile(profile)}
                  >
                    <span>
                      <strong>{profileName(profile)}</strong>
                      <small>
                        {profile.email}
                        {profile.student_id ? ` - ${profile.student_id}` : ''}
                      </small>
                    </span>
                    <span>{profile.role}</span>
                    <span>{profile.campus ? campusLabels[profile.campus] : 'No campus'}</span>
                    <span>
                      {visiblePassword !== ''
                        ? visiblePassword
                        : profile.must_change_password
                          ? 'Pending change'
                          : profile.status}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="workspace-grid">
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
            </section>

            <section className="workspace-panel">
              <h2>CSV import</h2>
              <p>
                Upload columns: full_name, role, campus, user_id.
                Role must be student or teacher.
              </p>
              <form className="workspace-form">
                <label>
                  <span>CSV file</span>
                  <input type="file" accept=".csv,text/csv" onChange={(event) => void handleCsvImport(event)} />
                </label>
              </form>
            </section>

            <section className="workspace-panel">
              <h2>Edit selected user</h2>
              {selectedProfile ? (
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
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          status: event.target.value as ProfileStatus,
                        }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
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
                </form>
              ) : (
                <p>Select a user to edit their profile.</p>
              )}
            </section>
          </aside>
        </div>
      )}
    </section>
  )
}

export default AdminUsersPage
