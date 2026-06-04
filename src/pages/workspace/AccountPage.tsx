import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import type { Role } from '../../hooks/useAuth'

const roleName: Record<Role, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
}

function AccountPage() {
  const navigate = useNavigate()
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user, signOut } = useAuthContext()
  const email = user?.email ?? 'Not signed in'
  const initials = email.slice(0, 2).toUpperCase()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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

      <div className="workspace-grid workspace-grid--two">
        <section className="workspace-panel account-summary">
          <span className="account-avatar">{initials}</span>
          <div>
            <h2>{email}</h2>
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
    </section>
  )
}

export default AccountPage
