import type { Role } from '../../../../hooks/useAuth'

export type WorkspaceLink = {
  label: string
  path: string
}

export const defaultWorkspacePathByRole: Record<Role, string> = {
  admin: 'courses',
  teacher: 'my-courses',
  student: 'my-courses',
}

export const roleLabel: Record<Role, string> = {
  admin: 'Admin workspace',
  teacher: 'Teacher workspace',
  student: 'Student workspace',
}

export const workspaceLinksByRole: Record<Role, WorkspaceLink[]> = {
  admin: [
    { label: 'Courses', path: 'courses' },
    { label: 'Course Offer', path: 'course-offer' },
    { label: 'Users', path: 'users' },
    { label: 'Inbox', path: 'inbox' },
    { label: 'Account', path: 'account' },
  ],
  teacher: [
    { label: 'Teaching courses', path: 'my-courses' },
    { label: 'Calendar', path: 'calendar' },
    { label: 'Inbox', path: 'inbox' },
    { label: 'Help', path: 'help' },
    { label: 'Account', path: 'account' },
  ],
  student: [
    { label: 'My courses', path: 'my-courses' },
    { label: 'Register', path: 'register' },
    { label: 'Calendar', path: 'calendar' },
    { label: 'Inbox', path: 'inbox' },
    { label: 'Help', path: 'help' },
    { label: 'Account', path: 'account' },
    { label: 'SWINLEARN', path: 'swinlearn' },
  ],
}

export const workspaceHomePath = (role: Role) =>
  `/${role}/${defaultWorkspacePathByRole[role]}`
