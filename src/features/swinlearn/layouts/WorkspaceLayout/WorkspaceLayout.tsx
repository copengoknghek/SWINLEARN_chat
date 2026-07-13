import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import { fetchInboxBadge } from '../../lib/workspace/api'
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

type WorkspaceSvgIcon = {
  pathData: string
  viewBox: string
}

type WorkspaceImageIcon = {
  alt: string
  src: string
}

type WorkspaceIcon = WorkspaceSvgIcon | WorkspaceImageIcon

type WorkspaceHeartBurst = {
  id: number
}

type WorkspaceHeartStyle = CSSProperties & {
  '--heart-delay': string
  '--heart-end-x': string
  '--heart-scale': string
  '--heart-x': string
}

const swinlearnHeartPattern = [
  { delay: 0, endX: -20, scale: 0.85, x: -14 },
  { delay: 60, endX: 18, scale: 1, x: 8 },
  { delay: 120, endX: -6, scale: 0.75, x: 0 },
  { delay: 180, endX: 28, scale: 0.9, x: 15 },
  { delay: 230, endX: -30, scale: 0.7, x: -8 },
] as const

function workspaceHeartStyle(heart: (typeof swinlearnHeartPattern)[number]): WorkspaceHeartStyle {
  return {
    '--heart-delay': `${heart.delay}ms`,
    '--heart-end-x': `${heart.endX}px`,
    '--heart-scale': String(heart.scale),
    '--heart-x': `${heart.x}px`,
  }
}

const workspaceNavIcons: Record<string, WorkspaceIcon> = {
  account: {
    pathData:
      'M399 384.2C376.9 345.8 335.4 320 288 320H224c-47.4 0-88.9 25.8-111 64.2C143.4 414.3 185.1 432 256 432s112.6-17.7 143-47.8zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 16a72 72 0 1 0 0-144 72 72 0 1 0 0 144z',
    viewBox: '0 0 512 512',
  },
  courses: {
    pathData:
      'M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z',
    viewBox: '0 0 448 512',
  },
  calendar: {
    pathData:
      'M128 0c17.7 0 32 14.3 32 32V64H288V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H448V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192zm64 80v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm128 0v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H208c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H336zM64 400v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H208zm112 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H336c-8.8 0-16 7.2-16 16z',
    viewBox: '0 0 448 512',
  },
  'course-offer': {
    pathData:
      'M160 64c0-35.3 28.7-64 64-64H576c35.3 0 64 28.7 64 64V352c0 35.3-28.7 64-64 64H336.8c-11.8-25.5-29.9-47.5-52.4-64H384V320c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32v32h64V64H224v49.1C205.8 102 184.7 96 162.3 96H160V64zm272 160a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM160 128a96 96 0 1 1 0 192 96 96 0 1 1 0-192zM133.3 352h53.3C260.3 352 320 411.7 320 485.3c0 14.7-11.9 26.7-26.7 26.7H26.7C11.9 512 0 500.1 0 485.3C0 411.7 59.7 352 133.3 352z',
    viewBox: '0 0 640 512',
  },
  inbox: {
    pathData:
      'M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9s-1.1-12.8 3.4-17.4l0 0 0 0 0 0 .3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208zM128 272a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm128 0a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm160-32a32 32 0 1 0-64 0 32 32 0 1 0 64 0z',
    viewBox: '0 0 512 512',
  },
  help: {
    pathData:
      'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1-64 0z',
    viewBox: '0 0 512 512',
  },
  requests: {
    pathData:
      'M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z',
    viewBox: '0 0 448 512',
  },
  register: {
    pathData:
      'M96 0C78.3 0 64 14.3 64 32V96h64V64H448v64h64V32c0-17.7-14.3-32-32-32H96zM0 160V480c0 17.7 14.3 32 32 32H544c17.7 0 32-14.3 32-32V160c0-17.7-14.3-32-32-32H32c-17.7 0-32 14.3-32 32zm382.8 84.8c12.5 12.5 12.5 32.8 0 45.3l-128 128c-12.5 12.5-32.8 12.5-45.3 0l-64-64c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L232 370.7 337.4 265.4c12.5-12.5 32.8-12.5 45.3 0z',
    viewBox: '0 0 576 512',
  },
  'my-courses': {
    pathData:
      'M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z',
    viewBox: '0 0 448 512',
  },
  users: {
    pathData:
      'M144 0a80 80 0 1 1 0 160A80 80 0 1 1 144 0zM512 0a80 80 0 1 1 0 160A80 80 0 1 1 512 0zM0 298.7C0 239.8 47.8 192 106.7 192h42.7c15.9 0 31 3.5 44.6 9.7c-1.3 7.2-1.9 14.7-1.9 22.3c0 38.2 16.8 72.5 43.3 96c-.2 0-.4 0-.7 0H21.3C9.6 320 0 310.4 0 298.7zM405.3 320c-.2 0-.4 0-.7 0c26.6-23.5 43.3-57.8 43.3-96c0-7.6-.7-15-1.9-22.3c13.6-6.3 28.7-9.7 44.6-9.7h42.7C592.2 192 640 239.8 640 298.7c0 11.8-9.6 21.3-21.3 21.3H405.3zM224 224a96 96 0 1 1 192 0a96 96 0 1 1-192 0zM128 485.3C128 411.7 187.7 352 261.3 352H378.7C452.3 352 512 411.7 512 485.3c0 14.7-11.9 26.7-26.7 26.7H154.7c-14.7 0-26.7-11.9-26.7-26.7z',
    viewBox: '0 0 640 512',
  },
  swinlearn: {
    alt: '',
    src: '/logoSwinlearn.png',
  },
}

const workspaceCollapseIcons: Record<'collapse' | 'expand', WorkspaceSvgIcon> = {
  collapse: {
    pathData:
      'M512 256A256 256 0 1 0 0 256a256 256 0 1 0 512 0zM215 127c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-71 71H376c13.3 0 24 10.7 24 24s-10.7 24-24 24H177.9l71 71c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L103 273c-9.4-9.4-9.4-24.6 0-33.9L215 127z',
    viewBox: '0 0 512 512',
  },
  expand: {
    pathData:
      'M0 256a256 256 0 1 0 512 0A256 256 0 1 0 0 256zM297 385c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l71-71H136c-13.3 0-24-10.7-24-24s10.7-24 24-24H334.1l-71-71c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0L409 239c9.4 9.4 9.4 24.6 0 33.9L297 385z',
    viewBox: '0 0 512 512',
  },
}

function WorkspaceNavIcon({
  icon,
}: {
  icon: WorkspaceIcon
}) {
  if ('src' in icon) {
    return (
      <img
        aria-hidden="true"
        alt={icon.alt}
        className="workspace-nav-icon workspace-nav-icon--image"
        src={icon.src}
      />
    )
  }

  return (
    <svg
      aria-hidden="true"
      className="workspace-nav-icon"
      focusable="false"
      viewBox={icon.viewBox}
    >
      <path d={icon.pathData} />
    </svg>
  )
}

function WorkspaceCollapseIcon({
  icon,
}: {
  icon: WorkspaceSvgIcon
}) {
  return (
    <svg
      aria-hidden="true"
      className="workspace-collapse-icon"
      focusable="false"
      viewBox={icon.viewBox}
    >
      <path d={icon.pathData} />
    </svg>
  )
}

function WorkspaceLayout({ workspaceRole }: WorkspaceLayoutProps) {
  const { user, role, mustChangePassword, loading } = useAuthContext()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [inboxBadgeTotal, setInboxBadgeTotal] = useState(0)
  const [swinlearnHeartBursts, setSwinlearnHeartBursts] = useState<WorkspaceHeartBurst[]>([])
  const heartBurstIdRef = useRef(0)
  const heartCleanupTimers = useRef<number[]>([])

  const loadInboxBadge = useCallback(async () => {
    try {
      const badge = await fetchInboxBadge()
      setInboxBadgeTotal(badge.total)
    } catch {
      setInboxBadgeTotal(0)
    }
  }, [])

  useEffect(() => {
    if (loading || user === null || role === null || mustChangePassword) {
      return
    }

    const hasInboxLink = workspaceLinksByRole[workspaceRole ?? role].some(
      (link) => link.path === 'inbox',
    )

    if (!hasInboxLink) {
      return
    }

    const timeoutId = window.setTimeout(() => void loadInboxBadge(), 0)
    const intervalId = window.setInterval(() => void loadInboxBadge(), 15000)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [loadInboxBadge, loading, mustChangePassword, role, user, workspaceRole])

  useEffect(() => {
    const cleanupTimers = heartCleanupTimers.current

    return () => {
      cleanupTimers.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [])

  const handleSwinlearnLinkClick = () => {
    const burstId = heartBurstIdRef.current

    heartBurstIdRef.current += 1
    setSwinlearnHeartBursts((bursts) => [...bursts, { id: burstId }])

    const timeoutId = window.setTimeout(() => {
      setSwinlearnHeartBursts((bursts) => bursts.filter((burst) => burst.id !== burstId))
    }, 1200)

    heartCleanupTimers.current.push(timeoutId)
  }

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

  return (
    <div className={`workspace-shell${isCollapsed ? ' workspace-shell--collapsed' : ''}`}>
      <aside className="workspace-sidebar" aria-label="Workspace navigation">
        <div className="workspace-brand">
          <NavLink to="/" aria-label="Swinburne University fanpage">
            <img src="/swinburneLogo.png" alt="Swinburne" className="workspace-logo" />
          </NavLink>
          <div>
            <span className="workspace-kicker">SWINBURNE</span>
            <strong>{loading ? 'Loading workspace' : roleLabel[effectiveRole]}</strong>
          </div>
        </div>

        <nav className="workspace-nav">
          {workspaceLinks.map((link) => {
            const icon = workspaceNavIcons[link.path]
            const isSwinlearnLink = link.path === 'swinlearn'
            const isInboxLink = link.path === 'inbox'
            const inboxBadgeLabel =
              inboxBadgeTotal > 99 ? '99+' : String(inboxBadgeTotal)
            const inboxAriaLabel =
              inboxBadgeTotal > 0 ? `Inbox, ${inboxBadgeTotal} notifications` : link.label

            return (
              <NavLink
                key={link.path}
                className={({ isActive }) =>
                  `workspace-nav-link${icon ? ' workspace-nav-link--stacked' : ''}${
                    isSwinlearnLink ? ' workspace-nav-link--swinlearn' : ''
                  }${
                    isInboxLink ? ' workspace-nav-link--inbox' : ''
                  }${
                    isActive ? ' workspace-nav-link--active' : ''
                  }`
                }
                to={`${basePath}/${link.path}`}
                title={link.label}
                aria-label={isInboxLink ? inboxAriaLabel : link.label}
                onClick={isSwinlearnLink ? handleSwinlearnLinkClick : undefined}
              >
                {icon && (
                  <span className="workspace-nav-icon-wrap">
                    <WorkspaceNavIcon icon={icon} />
                    {isInboxLink && inboxBadgeTotal > 0 && (
                      <span className="workspace-nav-badge" aria-hidden="true">
                        {inboxBadgeLabel}
                      </span>
                    )}
                  </span>
                )}
                <span className="workspace-nav-link-text">{link.label}</span>
                {isSwinlearnLink &&
                  swinlearnHeartBursts.map((burst) => (
                    <span aria-hidden="true" className="workspace-nav-heart-burst" key={burst.id}>
                      {swinlearnHeartPattern.map((heart) => (
                        <span
                          className="workspace-nav-heart"
                          key={`${burst.id}-${heart.delay}`}
                          style={workspaceHeartStyle(heart)}
                        >
                          &hearts;
                        </span>
                      ))}
                    </span>
                  ))}
              </NavLink>
            )
          })}
        </nav>
        <button
          type="button"
          className="workspace-collapse-toggle"
          onClick={() => setIsCollapsed((value) => !value)}
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <WorkspaceCollapseIcon
            icon={isCollapsed ? workspaceCollapseIcons.expand : workspaceCollapseIcons.collapse}
          />
        </button>
      </aside>

      <main className="workspace-content">
        <Outlet context={{ workspaceRole: effectiveRole }} />
      </main>
    </div>
  )
}

export default WorkspaceLayout
