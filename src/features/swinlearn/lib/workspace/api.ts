import { apiRequest } from '../../../../lib/api/client'
import type { Role } from '../../../../hooks/useAuth'
import type {
  AdminCourseData,
  AdminUserData,
  AdminUserCreateInput,
  AdminUserCreateResult,
  AdminUserImportResult,
  AssignmentMutationInput,
  AssignmentRow,
  AssignmentSubmissionRow,
  CatalogData,
  CourseCatalogInput,
  CourseMemberRole,
  CourseOfferingInput,
  CoursePrerequisiteGroupInput,
  CourseSessionRow,
  CourseWithMembers,
  CurriculumRuleInput,
  InboxData,
  ManagedUserCredentialRow,
  ProfileCampus,
  ProfileRow,
  ProfileStatus,
  RegistrationBasketResult,
  RegistrationData,
} from './types'

type ApiAuthPayload = {
  user: {
    id: string
    email: string
  } | null
  role?: Role | null
  mustChangePassword?: boolean
}

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? fallback)
  }

  return fallback
}

export async function fetchAdminUserData(): Promise<AdminUserData> {
  return apiRequest<AdminUserData>('/api/admin/users')
}

export async function getCurrentAuth() {
  return apiRequest<ApiAuthPayload>('/api/auth/me')
}

export async function login(email: string, password: string) {
  return apiRequest<ApiAuthPayload>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function logout() {
  await apiRequest<{ success: boolean }>('/api/auth/logout', { method: 'POST' })
}

export async function changePassword(password: string) {
  return apiRequest<ApiAuthPayload>('/api/auth/change-password', {
    method: 'POST',
    body: { password },
  })
}

export async function fetchCatalog(): Promise<CatalogData> {
  return apiRequest<CatalogData>('/api/workspace/catalog')
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  return apiRequest<ProfileRow[]>('/api/workspace/profiles')
}

export async function fetchManagedUserCredentials(): Promise<ManagedUserCredentialRow[]> {
  const data = await fetchAdminUserData()

  return data.managedCredentials
}

export async function fetchAdminCourseData(): Promise<AdminCourseData> {
  return apiRequest<AdminCourseData>('/api/admin/course-data')
}

export async function fetchWorkspaceCourses(): Promise<CourseWithMembers[]> {
  return apiRequest<CourseWithMembers[]>('/api/workspace/courses')
}

type CourseCreateCurriculumRuleInput = Omit<CurriculumRuleInput, 'course_id'>

export async function createCourse(
  input: CourseCatalogInput,
  curriculumRule: CourseCreateCurriculumRuleInput,
): Promise<string> {
  const course = await apiRequest<{ id: string }>('/api/admin/courses', {
    method: 'POST',
    body: {
      ...input,
      curriculum_rule: curriculumRule,
    },
  })

  return course.id
}

export async function updateCourse(courseId: string, input: Partial<CourseCatalogInput>) {
  await apiRequest(`/api/admin/courses/${courseId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteCourse(courseId: string) {
  await apiRequest(`/api/admin/courses/${courseId}`, { method: 'DELETE' })
}

export async function saveCoursePrerequisites(
  courseId: string,
  groups: CoursePrerequisiteGroupInput[],
) {
  await apiRequest(`/api/admin/courses/${courseId}/prerequisites`, {
    method: 'PUT',
    body: { groups },
  })
}

export async function createCurriculumRule(input: CurriculumRuleInput): Promise<string> {
  const rule = await apiRequest<{ id: string }>('/api/admin/curriculum-rules', {
    method: 'POST',
    body: input,
  })

  return rule.id
}

export async function updateCurriculumRule(ruleId: string, input: CurriculumRuleInput) {
  await apiRequest(`/api/admin/curriculum-rules/${ruleId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteCurriculumRule(ruleId: string) {
  await apiRequest(`/api/admin/curriculum-rules/${ruleId}`, { method: 'DELETE' })
}

export async function createCourseOffering(
  input: CourseOfferingInput,
  teacherId: string,
): Promise<string> {
  const offering = await apiRequest<{ id: string }>('/api/admin/course-offerings', {
    method: 'POST',
    body: {
      ...input,
      teacher_id: teacherId || null,
    },
  })

  return offering.id
}

export async function updateCourseOffering(
  offeringId: string,
  input: Partial<CourseOfferingInput>,
) {
  await apiRequest(`/api/admin/course-offerings/${offeringId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteCourseOffering(offeringId: string) {
  await apiRequest(`/api/admin/course-offerings/${offeringId}`, { method: 'DELETE' })
}

export async function addCourseMember(courseId: string, userId: string, role: CourseMemberRole) {
  await apiRequest(`/api/admin/course-offerings/${courseId}/members`, {
    method: 'POST',
    body: {
      user_id: userId,
      role,
    },
  })
}

export async function removeCourseMember(membershipId: string) {
  await apiRequest(`/api/admin/course-memberships/${encodeURIComponent(membershipId)}`, {
    method: 'DELETE',
  })
}

export async function approveCourseRegistrationRequest(requestId: string) {
  await apiRequest(`/api/admin/course-registration-requests/${requestId}/approve`, {
    method: 'POST',
  })
}

export async function rejectCourseRegistrationRequest(requestId: string) {
  await apiRequest(`/api/admin/course-registration-requests/${requestId}/reject`, {
    method: 'POST',
  })
}

export async function addStudentCourseCompletion(studentId: string, courseId: string) {
  await apiRequest(`/api/admin/users/${studentId}/completed-courses`, {
    method: 'POST',
    body: {
      course_id: courseId,
    },
  })
}

export async function removeStudentCourseCompletion(completionId: string) {
  await apiRequest(`/api/admin/student-course-completions/${completionId}`, {
    method: 'DELETE',
  })
}

export async function setTeachingAssistant(courseId: string, userId: string | null) {
  await apiRequest(`/api/admin/course-offerings/${courseId}/teaching-assistant`, {
    method: 'PUT',
    body: {
      user_id: userId,
    },
  })
}

export async function updateProfile(
  profileId: string,
  updates: {
    full_name?: string
    display_name?: string
    campus?: ProfileCampus | null
    student_id?: string | null
    main_major_id?: string | null
    child_major_id?: string | null
    role?: Role
    status?: ProfileStatus
  },
) {
  await apiRequest(`/api/admin/users/${profileId}`, {
    method: 'PATCH',
    body: updates,
  })
}

export async function invokeAdminUserAction(body: Record<string, unknown>) {
  const action = body.action

  if (action === 'create') {
    return apiRequest<AdminUserCreateResult>('/api/admin/users', {
      method: 'POST',
      body,
    })
  }

  if (action === 'import') {
    return apiRequest<{ results: AdminUserImportResult[] }>('/api/admin/users/import', {
      method: 'POST',
      body,
    })
  }

  if (action === 'reset_password') {
    return apiRequest<AdminUserCreateResult>(`/api/admin/users/${body.userId}/reset-password`, {
      method: 'POST',
    })
  }

  if (action === 'delete') {
    return apiRequest<{ success: boolean }>(`/api/admin/users/${body.userId}`, {
      method: 'DELETE',
    })
  }

  throw new Error('Unsupported admin user action.')
}

export async function createAdminUser(input: AdminUserCreateInput) {
  return invokeAdminUserAction({
    action: 'create',
    ...input,
  }) as Promise<AdminUserCreateResult>
}

export async function importAdminUsers(records: AdminUserCreateInput[]) {
  const data = await invokeAdminUserAction({
    action: 'import',
    records,
  })

  return (data as { results: AdminUserImportResult[] }).results
}

export async function resetAdminUserPassword(userId: string) {
  return invokeAdminUserAction({
    action: 'reset_password',
    userId,
  }) as Promise<AdminUserCreateResult>
}

export async function fetchAssignments(): Promise<AssignmentRow[]> {
  return apiRequest<AssignmentRow[]>('/api/workspace/assignments')
}

export async function fetchRegistrationData(): Promise<RegistrationData> {
  return apiRequest<RegistrationData>('/api/workspace/registration')
}

export async function checkRegistrationBasket(
  offeringIds: string[],
): Promise<RegistrationBasketResult> {
  return apiRequest<RegistrationBasketResult>('/api/workspace/registration/check', {
    method: 'POST',
    body: {
      offering_ids: offeringIds,
    },
  })
}

export async function registerForOfferings(offeringIds: string[]) {
  await apiRequest('/api/workspace/registration', {
    method: 'POST',
    body: {
      offering_ids: offeringIds,
    },
  })
}

export async function createAssignment(input: AssignmentMutationInput, _userId?: string) {
  void _userId

  await apiRequest('/api/workspace/assignments', {
    method: 'POST',
    body: input,
  })
}

export async function updateAssignment(
  assignmentId: string,
  updates: Partial<AssignmentMutationInput>,
) {
  await apiRequest(`/api/workspace/assignments/${assignmentId}`, {
    method: 'PATCH',
    body: updates,
  })
}

export async function fetchSubmissions(): Promise<AssignmentSubmissionRow[]> {
  return apiRequest<AssignmentSubmissionRow[]>('/api/workspace/submissions')
}

export async function submitAssignment(
  assignmentId: string,
  _studentId: string,
  body: string,
  files: FileList | null,
) {
  void _studentId

  const formData = new FormData()

  formData.set('body', body)

  for (const file of Array.from(files ?? [])) {
    formData.append('files', file)
  }

  await apiRequest(`/api/workspace/assignments/${assignmentId}/submission`, {
    method: 'POST',
    body: formData,
  })
}

export async function fetchCalendarSessions(): Promise<CourseSessionRow[]> {
  return apiRequest<CourseSessionRow[]>('/api/workspace/sessions')
}

export async function fetchInboxData(_userId: string): Promise<InboxData> {
  void _userId

  return apiRequest<InboxData>('/api/workspace/inbox')
}

export async function createInboxThread(
  _currentUserId: string,
  recipientId: string,
  subject: string,
  messageBody: string,
) {
  void _currentUserId

  const data = await apiRequest<{ id: string }>('/api/workspace/inbox/threads', {
    method: 'POST',
    body: {
      recipient_id: recipientId,
      subject,
      body: messageBody,
    },
  })

  return data.id
}

export async function sendInboxMessage(threadId: string, _senderId: string, body: string) {
  void _senderId

  await apiRequest(`/api/workspace/inbox/threads/${threadId}/messages`, {
    method: 'POST',
    body: { body },
  })
}

export async function markThreadRead(threadId: string, _userId: string) {
  void _userId

  await apiRequest(`/api/workspace/inbox/threads/${threadId}/read`, {
    method: 'PATCH',
  })
}

export function profileName(profile: ProfileRow | undefined) {
  if (!profile) {
    return 'Unknown user'
  }

  return profile.display_name || profile.full_name || profile.email || 'Workspace user'
}

export function roleAllowedRecipient(currentRole: Role, candidate: ProfileRow) {
  if (candidate.status !== 'active') {
    return false
  }

  if (currentRole === 'admin') {
    return candidate.role === 'teacher' || candidate.role === 'student'
  }

  if (currentRole === 'teacher') {
    return candidate.role === 'admin' || candidate.role === 'student'
  }

  return candidate.role === 'admin' || candidate.role === 'teacher'
}

export function courseLabel(course: Pick<CourseWithMembers, 'code' | 'title'>) {
  return `${course.code} - ${course.title}`
}

const byTitle = <T extends { title: string }>(items: T[]) =>
  [...items].sort((first, second) => first.title.localeCompare(second.title))

export function orderedProfiles(profiles: ProfileRow[]) {
  return byTitle(
    profiles.map((profile) => ({
      ...profile,
      title: profileName(profile),
    })),
  )
}
