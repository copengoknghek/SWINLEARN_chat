import { useRef, useState } from 'react'

import { useNavigate, useOutletContext } from 'react-router-dom'

import { useAuthContext } from '../../../../context/AuthContext'

import type { Role } from '../../../../hooks/useAuth'

import {
  exportAcademicProgressPdf,
  exportAcademicProgressXlsx,
  fetchAcademicProgress,
  getErrorMessage,
  removeProfileAvatar,
  uploadProfileAvatar,
} from '../../lib/workspace/api'

import type { AcademicProgressData } from '../../lib/workspace/types'

import { buildGradeWarningDetail } from '../../lib/gradeWarningDetail.mjs'

import { ProfileAvatar } from '../../components/ProfileAvatar'

import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'

const roleName: Record<Role, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
}

const progressRowClass = (grade?: string | null) => {
  if (grade === 'F') {
    return 'workspace-row account-progress-row account-progress-row--critical'
  }

  if (grade === 'P' || grade === 'C') {
    return 'workspace-row account-progress-row account-progress-row--warning'
  }

  if (grade === 'D' || grade === 'HD') {
    return 'workspace-row account-progress-row account-progress-row--distinction'
  }

  return 'workspace-row account-progress-row'
}

function AccountPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user, signOut, refreshProfile } = useAuthContext()
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressError, setProgressError] = useState('')
  const [exportingGrades, setExportingGrades] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [academicProgress, setAcademicProgress] = useState<AcademicProgressData | null>(null)

  const email = user?.email ?? 'Not signed in'
  const profileName = user?.fullName?.trim() || user?.displayName?.trim()
  const displayName = profileName || user?.email?.split('@')[0] || 'Workspace user'
  const avatarProfile = {
    full_name: user?.fullName ?? null,
    display_name: user?.displayName ?? null,
    email: user?.email ?? null,
    student_id: null,
    avatar_url: user?.avatarUrl ?? null,
  }
  const warningDetail = academicProgress ? buildGradeWarningDetail(academicProgress) : null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setUploading(true)
    setAvatarError(null)

    try {
      await uploadProfileAvatar(file)
      await refreshProfile()
    } catch (error) {
      setAvatarError(getErrorMessage(error, 'Could not update profile image.'))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleAvatarRemove = async () => {
    if (!user?.avatarUrl) {
      return
    }

    setUploading(true)
    setAvatarError(null)

    try {
      await removeProfileAvatar()
      await refreshProfile()
    } catch (error) {
      setAvatarError(getErrorMessage(error, 'Could not remove profile image.'))
    } finally {
      setUploading(false)
    }
  }

  const handleShowProgress = async () => {
    if (academicProgress) {
      setShowProgress(true)
      return
    }

    setShowProgress(true)
    setProgressLoading(true)
    setProgressError('')

    try {
      const progress = await fetchAcademicProgress()
      setAcademicProgress(progress)
    } catch (error) {
      setProgressError(getErrorMessage(error, 'Academic progress could not be loaded.'))
    } finally {
      setProgressLoading(false)
    }
  }

  const handleExportGrades = async () => {
    setExportingGrades(true)
    setProgressError('')

    try {
      await exportAcademicProgressXlsx()
    } catch (error) {
      setProgressError(getErrorMessage(error, 'Grade report could not be exported.'))
    } finally {
      setExportingGrades(false)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    setProgressError('')

    try {
      await exportAcademicProgressPdf()
    } catch (error) {
      setProgressError(getErrorMessage(error, 'Grade report could not be exported.'))
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">Account</h1>
        <p className="workspace-page-subtitle">
          Review your profile, role, and workspace preferences.
        </p>
      </header>

      <WorkspaceAlertStack
        error={avatarError ?? progressError}
        onDismissError={() => {
          setAvatarError(null)
          setProgressError('')
        }}
      />

      <div className="workspace-grid workspace-grid--two">
        <section className="workspace-panel account-summary">
          <div className="account-avatar-picker">
            <button
              type="button"
              className="account-avatar-button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ProfileAvatar profile={avatarProfile} size="md" />
              <span className="account-avatar-button-label">
                {uploading ? 'Saving...' : 'Change photo'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="account-avatar-input"
              disabled={uploading}
              onChange={(event) => void handleAvatarUpload(event)}
            />
            {user?.avatarUrl && (
              <button
                type="button"
                className="account-avatar-remove"
                disabled={uploading}
                onClick={() => void handleAvatarRemove()}
              >
                Remove photo
              </button>
            )}
          </div>
          <div>
            <span className="account-summary-label">Signed in as</span>
            <h2>{displayName}</h2>
            <p>{email}</p>
            <p>{roleName[workspaceRole]} access</p>
            <div className="workspace-meta-row">
              <span className="workspace-chip">Swinburne account</span>
              {workspaceRole === 'student' && <span className="workspace-chip">SWINLEARN enabled</span>}
            </div>
          </div>
        </section>

        <aside className="workspace-panel">
          <h2>Account actions</h2>
          <p>Use this area for profile settings, notification preferences, and access control.</p>
          <button type="button" className="workspace-primary-action" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </aside>
      </div>

      {workspaceRole === 'student' && (
        <section className="workspace-panel account-progress-panel">
          {!showProgress ? (
            <div className="account-progress-intro">
              <h2>Academic progress</h2>
              <p>View your completed courses, credit points, and grade summary when you are ready.</p>
              <button type="button" className="workspace-primary-action account-progress-trigger" onClick={() => void handleShowProgress()}>
                View academic progress
              </button>
            </div>
          ) : (
            <>
              <div className="workspace-section-heading">
                <h2>Academic progress</h2>
                {academicProgress && (
                  <div className="account-progress-actions">
                    <button
                      type="button"
                      className="workspace-secondary-action"
                      onClick={() => void handleExportGrades()}
                      disabled={exportingGrades || exportingPdf || academicProgress.completed_courses.length === 0}
                    >
                      {exportingGrades ? 'Exporting...' : 'Export Excel'}
                    </button>
                    <button
                      type="button"
                      className="workspace-secondary-action"
                      onClick={() => void handleExportPdf()}
                      disabled={exportingGrades || exportingPdf || academicProgress.completed_courses.length === 0}
                    >
                      {exportingPdf ? 'Exporting...' : 'Export PDF'}
                    </button>
                    <span className="workspace-chip account-progress-total">
                      {academicProgress.total_credit_points} credit points
                    </span>
                  </div>
                )}
              </div>

              {progressLoading && (
                <div className="workspace-empty-state">Loading academic progress...</div>
              )}

              {!progressLoading && academicProgress && warningDetail && (
                <div className="account-progress-layout">
                  <div className="account-progress-main">
                    <p className="account-progress-summary">
                      {academicProgress.passed_course_count} passed course
                      {academicProgress.passed_course_count === 1 ? '' : 's'} in your program
                    </p>
                    <div className="workspace-table account-progress-table account-progress-table--compact">
                      {academicProgress.completed_courses.map((course) => (
                        <div className={progressRowClass(course.grade)} key={course.id}>
                          <span>
                            <strong>{course.code}</strong>
                            <small>{course.title}</small>
                          </span>
                          <span>{course.final_score}</span>
                          <span className="workspace-chip">
                            {course.grade ? `${course.grade} · ${course.grade_label}` : '-'}
                          </span>
                          <span>
                            {course.counts_toward_total
                              ? `${course.earned_credit_points} CP`
                              : '-'}
                          </span>
                        </div>
                      ))}
                      {academicProgress.completed_courses.length === 0 && (
                        <div className="workspace-empty-state">No completed courses recorded yet.</div>
                      )}
                    </div>
                  </div>

                  <aside className="account-grade-detail">
                    <h3>Warning detail</h3>
                    <p className="account-grade-detail-summary">
                      {warningDetail.total_courses_studied} course
                      {warningDetail.total_courses_studied === 1 ? '' : 's'} studied
                    </p>
                    <div className="account-grade-detail-metrics">
                      <span>
                        {warningDetail.earned_credit_points} / {warningDetail.degree_credit_points} credit points
                      </span>
                      <span>
                        {warningDetail.passed_course_count} / {warningDetail.required_passing_courses} courses
                      </span>
                      <span>GPA {warningDetail.gpa.toFixed(1)} / 4.0</span>
                    </div>

                    <section className="account-grade-detail-group account-grade-detail-group--fail">
                      <h4>Fail (F)</h4>
                      {warningDetail.fail_courses.length === 0 ? (
                        <p>None</p>
                      ) : (
                        <ul>
                          {warningDetail.fail_courses.map((course) => (
                            <li key={course.id ?? course.code}>
                              {course.code} · {course.final_score}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="account-grade-detail-group account-grade-detail-group--pass">
                      <h4>Pass / Credit (P, C)</h4>
                      {warningDetail.pass_courses.length === 0 ? (
                        <p>None</p>
                      ) : (
                        <ul>
                          {warningDetail.pass_courses.map((course) => (
                            <li key={course.id ?? course.code}>
                              {course.code} · {course.final_score} ({course.grade})
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="account-grade-detail-group account-grade-detail-group--distinction">
                      <h4>Distinction / HD (D, HD)</h4>
                      {warningDetail.distinction_courses.length === 0 ? (
                        <p>None</p>
                      ) : (
                        <ul>
                          {warningDetail.distinction_courses.map((course) => (
                            <li key={course.id ?? course.code}>
                              {course.code} · {course.final_score} ({course.grade})
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </aside>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  )
}

export default AccountPage
