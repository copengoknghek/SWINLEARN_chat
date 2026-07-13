import { useEffect, useRef, useState } from 'react'

import { useNavigate, useOutletContext } from 'react-router-dom'

import { useAuthContext } from '../../../../context/AuthContext'

import type { Role } from '../../../../hooks/useAuth'

import {

  fetchAcademicProgress,

  getErrorMessage,

  removeProfileAvatar,

  uploadProfileAvatar,

} from '../../lib/workspace/api'

import type { AcademicProgressData } from '../../lib/workspace/types'

import { ProfileAvatar } from '../../components/ProfileAvatar'

import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'



const roleName: Record<Role, string> = {

  admin: 'Admin',

  teacher: 'Teacher',

  student: 'Student',

}



function AccountPage() {

  const navigate = useNavigate()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()

  const { user, signOut, refreshProfile } = useAuthContext()

  const [uploading, setUploading] = useState(false)

  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [progressLoading, setProgressLoading] = useState(workspaceRole === 'student')

  const [progressError, setProgressError] = useState('')

  const [academicProgress, setAcademicProgress] = useState<AcademicProgressData | null>(null)

  const email = user?.email ?? 'Not signed in'

  const profileName = user?.fullName?.trim() || user?.displayName?.trim()

  const displayName =

    profileName ||

    user?.email?.split('@')[0] ||

    'Workspace user'

  const avatarProfile = {

    full_name: user?.fullName ?? null,

    display_name: user?.displayName ?? null,

    email: user?.email ?? null,

    student_id: null,

    avatar_url: user?.avatarUrl ?? null,

  }



  useEffect(() => {

    if (workspaceRole !== 'student') {

      return

    }



    let cancelled = false



    const loadProgress = async () => {

      setProgressLoading(true)

      setProgressError('')



      try {

        const progress = await fetchAcademicProgress()



        if (!cancelled) {

          setAcademicProgress(progress)

        }

      } catch (error) {

        if (!cancelled) {

          setProgressError(getErrorMessage(error, 'Academic progress could not be loaded.'))

        }

      } finally {

        if (!cancelled) {

          setProgressLoading(false)

        }

      }

    }



    void loadProgress()



    return () => {

      cancelled = true

    }

  }, [workspaceRole])



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

          <button

            type="button"

            className="workspace-primary-action"

            onClick={() => void handleSignOut()}

          >

            Sign out

          </button>

        </aside>

      </div>



      {workspaceRole === 'student' && (

        <section className="workspace-panel account-progress-panel">

          <div className="workspace-section-heading">

            <div>

              <h2>Academic progress</h2>

              <p>Completed courses and credit points earned in your program.</p>

            </div>

            {academicProgress && (

              <span className="workspace-chip account-progress-total">

                {academicProgress.total_credit_points} credit points

              </span>

            )}

          </div>



          {progressLoading && (

            <div className="workspace-empty-state">Loading academic progress...</div>

          )}



          {!progressLoading && academicProgress && (

            <>

              <p className="account-progress-summary">

                {academicProgress.passed_course_count} passed course

                {academicProgress.passed_course_count === 1 ? '' : 's'} in your program

              </p>



              <div className="workspace-table account-progress-table">

                {academicProgress.completed_courses.map((course) => (

                  <div className="workspace-row account-progress-row" key={course.id}>

                    <span>

                      <strong>{course.code}</strong>

                      <small>{course.title}</small>

                    </span>

                    <span>{course.final_score}</span>

                    <span className="workspace-chip">

                      {course.grade ? `${course.grade} · ${course.grade_label}` : '—'}

                    </span>

                    <span>

                      {course.counts_toward_total

                        ? `${course.earned_credit_points} credit points`

                        : '—'}

                    </span>

                  </div>

                ))}



                {academicProgress.completed_courses.length === 0 && (

                  <div className="workspace-empty-state">No completed courses recorded yet.</div>

                )}

              </div>

            </>

          )}

        </section>

      )}

    </section>

  )

}



export default AccountPage

