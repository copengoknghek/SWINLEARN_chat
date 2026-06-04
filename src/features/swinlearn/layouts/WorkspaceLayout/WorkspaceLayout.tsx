import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import {
  roleLabel,
  workspaceHomePath,
  workspaceLinksByRole,
} from '../../lib/workspace/navigation'
import './WorkspaceLayout.css'
import '../../styles/WorkspacePages.css'

type WorkspaceLayoutProps = {
  workspaceRole?: Role
}

function WorkspaceLayout({ workspaceRole }: WorkspaceLayoutProps) {
  const navigate = useNavigate()
  const { user, role, mustChangePassword, loading, signOut } = useAuthContext()
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="workspace-loading" role="status">
        Loading workspace...
      </div>
    )
  }

  if (user === null) {
    return <Navigate to="/login" replace />
  }

  if (role === null) {
    return (
      <div className="workspace-loading" role="alert">
        Your profile does not have a workspace role yet. Ask an admin to assign
        admin, teacher, or student access.
      </div>
    )
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (workspaceRole !== undefined && workspaceRole !== role) {
    return <Navigate to={workspaceHomePath(role)} replace />
  }

  const effectiveRole = workspaceRole ?? role
  const basePath = `/${effectiveRole}`
  const workspaceLinks = workspaceLinksByRole[effectiveRole]
  const displayName = user?.email?.split('@')[0] ?? 'Workspace user'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className={`workspace-shell${isCollapsed ? ' workspace-shell--collapsed' : ''}`}>
      <aside className="workspace-sidebar" aria-label="Workspace navigation">
        <div className="workspace-brand">
          <NavLink to="/" aria-label="Swinburne University fanpage">
            <img src="/swinburneLogo.png" alt="Swinburne" className="workspace-logo" />
          </NavLink>
          <div>
            <span className="workspace-kicker">SWINLEARN</span>
            <strong>{loading ? 'Loading workspace' : roleLabel[effectiveRole]}</strong>
          </div>
        </div>

        <button
          type="button"
          className="workspace-collapse-toggle"
          onClick={() => setIsCollapsed((value) => !value)}
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {isCollapsed ? '>' : '<'}
        </button>

        <nav className="workspace-nav">
          {workspaceLinks.map((link) => (
            <NavLink
              key={link.path}
              className={({ isActive }) =>
                `workspace-nav-link${isActive ? ' workspace-nav-link--active' : ''}`
              }
              to={`${basePath}/${link.path}`}
              title={link.label}
            >
              <span className="workspace-nav-link-text">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="workspace-user">
          <span className="workspace-user-label">Signed in as</span>
          <strong>{displayName}</strong>
          <button type="button" className="workspace-signout" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="workspace-content">
        <Outlet context={{ workspaceRole: effectiveRole }} />
      </main>
    </div>
  )
}

export default WorkspaceLayout
