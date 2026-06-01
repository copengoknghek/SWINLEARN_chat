import type { Role } from '../../hooks/useAuth'

export type ProfileStatus = 'active' | 'inactive'
export type ProfileCampus = 'hanoi' | 'danang' | 'hcm'
export type CourseSemester = 'previous' | 'current' | 'next'
export type CourseStatus = 'active' | 'archived'
export type CourseMemberRole = 'teacher' | 'teaching_assistant' | 'student'
export type AssignmentStatus = 'draft' | 'published' | 'archived'
export type SessionType = 'class' | 'lab' | 'event' | 'consultation'

export type ProfileRow = {
  id: string
  email: string | null
  role: Role
  full_name: string | null
  display_name: string | null
  campus: ProfileCampus | null
  student_id: string | null
  must_change_password: boolean
  status: ProfileStatus
  created_at?: string
  updated_at?: string
}

export type AdminUserCreateInput = {
  full_name: string
  role: 'teacher' | 'student'
  campus: ProfileCampus
  user_id: string
}

export type AdminUserCreateResult = {
  success: boolean
  user_id: string
  email: string
  temp_password: string
}

export type AdminUserImportResult = {
  row: number
  email: string
  success: boolean
  user_id?: string
  temp_password?: string
  error?: string
}

export type ManagedUserCredentialRow = {
  user_id: string
  temp_password: string
  created_by: string | null
  created_at: string
}

export type MainMajorRow = {
  id: string
  title: string
  summary: string
  sort_order: number
}

export type ChildMajorRow = {
  id: string
  main_major_id: string
  title: string
  summary: string
  sort_order: number
}

export type CourseRow = {
  id: string
  child_major_id: string
  code: string
  title: string
  description: string
  semester: CourseSemester
  academic_year: number
  status: CourseStatus
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type CourseMembershipRow = {
  id: string
  course_id: string
  user_id: string
  role: CourseMemberRole
  created_at?: string
}

export type AssignmentRow = {
  id: string
  course_id: string
  title: string
  description: string
  due_at: string
  status: AssignmentStatus
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type AssignmentSubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  body: string
  file_paths: string[]
  submitted_at: string
  updated_at?: string
}

export type CourseSessionRow = {
  id: string
  course_id: string
  title: string
  session_type: SessionType
  starts_at: string
  ends_at: string
  location: string
  created_by: string | null
  created_at?: string
}

export type InboxThreadRow = {
  id: string
  subject: string
  course_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type InboxParticipantRow = {
  id: string
  thread_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
}

export type InboxMessageRow = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
}

export type CatalogData = {
  mainMajors: MainMajorRow[]
  childMajors: ChildMajorRow[]
}

export type CourseWithMembers = CourseRow & {
  members: CourseMembershipRow[]
}

export type AdminCourseData = CatalogData & {
  courses: CourseWithMembers[]
  profiles: ProfileRow[]
}

export type CourseMutationInput = {
  child_major_id: string
  code: string
  title: string
  description: string
  semester: CourseSemester
  academic_year: number
  status: CourseStatus
}

export type AssignmentMutationInput = {
  course_id: string
  title: string
  description: string
  due_at: string
  status: AssignmentStatus
}

export type InboxData = {
  profiles: ProfileRow[]
  threads: InboxThreadRow[]
  participants: InboxParticipantRow[]
  messages: InboxMessageRow[]
}
