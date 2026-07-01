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
  CourseContentPackageSummaryRow,
  CourseDetailData,
  CourseMemberRole,
  CourseOfferingInput,
  CoursePrerequisiteGroupInput,
  CourseSessionRow,
  CourseWithMembers,
  CurriculumRuleInput,
  ConnectionRow,
  CommunityData,
  CommunityCommentRow,
  CommunityPostRow,
  GiphySearchResult,
  InboxData,
  ConversationRow,
  ManagedUserCredentialRow,
  PersonSearchResult,
  ProfileCampus,
  ProfileRow,
  RegistrationBasketResult,
  RegistrationData,
  SwinlearnContextData,
  SwinlearnSendMessageResult,
  SwinlearnThreadRow,
  ConsultationTeacherRow,
  HelpRequestInput,
  HelpRequestRow,
  HelpRequestStatus,
  AcademicProgressData,
  RoomRow,
} from './types'

type ApiAuthPayload = {
  user: {
    id: string
    email: string
  } | null
  profile?: Pick<ProfileRow, 'full_name' | 'display_name' | 'avatar_url'> | null
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

export async function uploadProfileAvatar(file: File): Promise<ProfileRow> {
  const formData = new FormData()
  formData.set('avatar', file)

  return apiRequest<ProfileRow>('/api/workspace/profile/avatar', {
    method: 'POST',
    body: formData,
  })
}

export async function removeProfileAvatar(): Promise<ProfileRow> {
  return apiRequest<ProfileRow>('/api/workspace/profile/avatar', {
    method: 'DELETE',
  })
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

export async function fetchCourseDetail(courseId: string): Promise<CourseDetailData> {
  return apiRequest<CourseDetailData>(`/api/workspace/courses/${encodeURIComponent(courseId)}/detail`)
}

export async function fetchCommunity(courseId: string): Promise<CommunityData> {
  return apiRequest<CommunityData>(
    `/api/workspace/courses/${encodeURIComponent(courseId)}/community`,
  )
}

export async function createCommunityPost(
  courseId: string,
  body: string,
  images: File[] = [],
): Promise<CommunityPostRow> {
  const formData = new FormData()

  formData.set('body', body)

  for (const image of images) {
    formData.append('images', image)
  }

  return apiRequest<CommunityPostRow>(
    `/api/workspace/courses/${encodeURIComponent(courseId)}/community/posts`,
    {
      method: 'POST',
      body: formData,
    },
  )
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  await apiRequest(`/api/workspace/community/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  })
}

export async function shareCommunityPost(
  courseId: string,
  postId: string,
  recipientId: string,
  sharePath: string,
): Promise<{ conversation_id: string; success: boolean }> {
  return apiRequest<{ conversation_id: string; success: boolean }>(
    `/api/workspace/courses/${encodeURIComponent(courseId)}/community/posts/${encodeURIComponent(postId)}/share`,
    {
      method: 'POST',
      body: { recipient_id: recipientId, share_path: sharePath },
    },
  )
}

export async function searchCommunityGiphy(
  query: string,
  offset = 0,
): Promise<GiphySearchResult> {
  const params = new URLSearchParams({
    offset: String(offset),
  })

  const trimmedQuery = query.trim()

  if (trimmedQuery) {
    params.set('q', trimmedQuery)
  }

  return apiRequest<GiphySearchResult>(`/api/workspace/community/giphy?${params.toString()}`)
}

export async function createCommunityComment(
  courseId: string,
  postId: string,
  input: {
    body: string
    parentId?: string
    gifUrl?: string
    images?: File[]
  },
): Promise<CommunityCommentRow> {
  const formData = new FormData()

  formData.set('body', input.body)

  if (input.parentId) {
    formData.set('parent_id', input.parentId)
  }

  if (input.gifUrl) {
    formData.set('gif_url', input.gifUrl)
  }

  for (const image of input.images ?? []) {
    formData.append('images', image)
  }

  return apiRequest<CommunityCommentRow>(
    `/api/workspace/courses/${encodeURIComponent(courseId)}/community/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      body: formData,
    },
  )
}

export async function toggleCommunityCommentLike(
  courseId: string,
  commentId: string,
): Promise<{ liked: boolean; like_count: number }> {
  return apiRequest<{ liked: boolean; like_count: number }>(
    `/api/workspace/courses/${encodeURIComponent(courseId)}/community/comments/${encodeURIComponent(commentId)}/like`,
    { method: 'POST' },
  )
}

export async function deleteCommunityComment(commentId: string): Promise<void> {
  await apiRequest(`/api/workspace/community/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  })
}

export async function toggleCommunityLike(
  courseId: string,
  postId: string,
): Promise<{ liked: boolean; like_count: number }> {
  return apiRequest<{ liked: boolean; like_count: number }>(
    `/api/workspace/courses/${encodeURIComponent(courseId)}/community/posts/${encodeURIComponent(postId)}/like`,
    { method: 'POST' },
  )
}

export async function fetchSwinlearnContext(): Promise<SwinlearnContextData> {
  return apiRequest<SwinlearnContextData>('/api/workspace/swinlearn/context')
}

export async function fetchSwinlearnThreads(): Promise<SwinlearnThreadRow[]> {
  return apiRequest<SwinlearnThreadRow[]>('/api/workspace/swinlearn/threads')
}

export async function createSwinlearnThread(
  title: string,
  selectedOfferingIds: string[],
): Promise<SwinlearnThreadRow> {
  return apiRequest<SwinlearnThreadRow>('/api/workspace/swinlearn/threads', {
    method: 'POST',
    body: {
      selected_offering_ids: selectedOfferingIds,
      title,
    },
  })
}

export async function fetchSwinlearnThread(threadId: string): Promise<SwinlearnThreadRow> {
  return apiRequest<SwinlearnThreadRow>(
    `/api/workspace/swinlearn/threads/${encodeURIComponent(threadId)}`,
  )
}

export async function updateSwinlearnThread(
  threadId: string,
  updates: { title?: string; pinned?: boolean },
): Promise<SwinlearnThreadRow> {
  return apiRequest<SwinlearnThreadRow>(
    `/api/workspace/swinlearn/threads/${encodeURIComponent(threadId)}`,
    {
      method: 'PATCH',
      body: updates,
    },
  )
}

export async function deleteSwinlearnThread(threadId: string): Promise<void> {
  await apiRequest(`/api/workspace/swinlearn/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
  })
}

export async function indexSwinlearnCourses(selectedOfferingIds: string[]) {
  return apiRequest('/api/workspace/swinlearn/index', {
    method: 'POST',
    body: {
      selected_offering_ids: selectedOfferingIds,
    },
  })
}

export async function sendSwinlearnMessage(
  threadId: string,
  message: string,
  selectedOfferingIds: string[],
  files: FileList | File[] | null,
): Promise<SwinlearnSendMessageResult> {
  const formData = new FormData()

  formData.set('message', message)
  formData.set('selected_offering_ids', JSON.stringify(selectedOfferingIds))

  for (const file of Array.from(files ?? [])) {
    formData.append('files', file)
  }

  return apiRequest<SwinlearnSendMessageResult>(
    `/api/workspace/swinlearn/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: 'POST',
      body: formData,
    },
  )
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

export async function importCourseOfferingContent(offeringId: string, file: File) {
  const formData = new FormData()

  formData.set('file', file)

  return apiRequest<CourseContentPackageSummaryRow>(
    `/api/admin/course-offerings/${encodeURIComponent(offeringId)}/content-import`,
    {
      method: 'POST',
      body: formData,
    },
  )
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

export async function addStudentCourseCompletion(
  studentId: string,
  courseId: string,
  finalScore: number,
) {
  await apiRequest(`/api/admin/users/${studentId}/completed-courses`, {
    method: 'POST',
    body: {
      course_id: courseId,
      final_score: finalScore,
    },
  })
}

export async function updateStudentCourseCompletion(completionId: string, finalScore: number) {
  await apiRequest(`/api/admin/student-course-completions/${completionId}`, {
    method: 'PATCH',
    body: {
      final_score: finalScore,
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

type DownloadAuthedFileOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
}

const downloadAuthedFile = async (
  path: string,
  fallbackFilename: string,
  options: DownloadAuthedFileOptions = {},
) => {
  const { method = 'GET', body } = options
  const headers = new Headers()

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = 'Download failed.'

    try {
      const data = text ? JSON.parse(text) : null

      if (data && typeof data === 'object' && 'error' in data) {
        message = String((data as { error: unknown }).error)
      } else if (text && !text.trimStart().startsWith('<!DOCTYPE')) {
        message = text
      }
    } catch {
      if (text && !text.trimStart().startsWith('<!DOCTYPE')) {
        message = text
      }
    }

    throw new Error(message)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filenameMatch = disposition.match(/filename="([^"]+)"/)
  const filename = filenameMatch?.[1] ?? fallbackFilename
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

export const formatExportTimestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

export async function downloadAdminUserImportTemplate() {
  await downloadAuthedFile('/api/admin/users/import-template', 'admin-user-import-template.xlsx')
}

export async function downloadUsersExport(ids: string[], includeCredentials: boolean) {
  const timestamp = formatExportTimestamp()
  const fallbackFilename = includeCredentials
    ? `swinlearn-users-credentials-${timestamp}.xlsx`
    : `swinlearn-users-${timestamp}.xlsx`

  await downloadAuthedFile('/api/admin/users/export', fallbackFilename, {
    method: 'POST',
    body: {
      ids,
      include_credentials: includeCredentials,
    },
  })
}

export async function importAdminUsersWorkbook(file: File): Promise<AdminUserImportResult[]> {
  const formData = new FormData()
  formData.set('file', file)

  const data = await apiRequest<{ results: AdminUserImportResult[] }>('/api/admin/users/import-workbook', {
    method: 'POST',
    body: formData,
  })

  return data.results
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

export async function fetchAcademicProgress(): Promise<AcademicProgressData> {
  return apiRequest<AcademicProgressData>('/api/workspace/academic-progress')
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

export async function fetchInboxData(): Promise<InboxData> {
  return apiRequest<InboxData>('/api/workspace/inbox')
}

export async function searchPeople(
  query: string,
  courseId?: string,
): Promise<PersonSearchResult[]> {
  const params = new URLSearchParams()

  if (query.trim()) {
    params.set('query', query.trim())
  }

  if (courseId) {
    params.set('course_id', courseId)
  }

  const data = await apiRequest<{ results: PersonSearchResult[] }>(
    `/api/workspace/inbox/people?${params.toString()}`,
  )

  return data.results
}

export async function sendConnectionRequest(addresseeId: string): Promise<ConnectionRow> {
  return apiRequest<ConnectionRow>('/api/workspace/inbox/connections', {
    method: 'POST',
    body: { addressee_id: addresseeId },
  })
}

export async function respondToConnection(
  connectionId: string,
  action: 'accept' | 'decline',
): Promise<ConnectionRow> {
  return apiRequest<ConnectionRow>(
    `/api/workspace/inbox/connections/${encodeURIComponent(connectionId)}/${action}`,
    { method: 'POST' },
  )
}

export async function cancelConnection(connectionId: string): Promise<void> {
  await apiRequest(`/api/workspace/inbox/connections/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
  })
}

export async function openConversation(recipientId: string): Promise<string> {
  const data = await apiRequest<{ id: string }>('/api/workspace/inbox/conversations', {
    method: 'POST',
    body: { recipient_id: recipientId },
  })

  return data.id
}

export async function sendInboxMessage(conversationId: string, body: string): Promise<void> {
  await apiRequest(
    `/api/workspace/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      body: { body },
    },
  )
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiRequest(
    `/api/workspace/inbox/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: 'PATCH' },
  )
}

export async function createGroupConversation(name: string, memberIds: string[]): Promise<string> {
  const data = await apiRequest<{ id: string }>('/api/workspace/inbox/groups', {
    method: 'POST',
    body: { name, member_ids: memberIds },
  })

  return data.id
}

export async function updateConversation(
  conversationId: string,
  updates: { color?: string | null; name?: string },
): Promise<ConversationRow> {
  return apiRequest<ConversationRow>(
    `/api/workspace/inbox/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'PATCH',
      body: updates,
    },
  )
}

export async function setConversationNickname(
  conversationId: string,
  targetUserId: string,
  nickname: string | null,
): Promise<ConversationRow> {
  return apiRequest<ConversationRow>(
    `/api/workspace/inbox/conversations/${encodeURIComponent(conversationId)}/nickname`,
    {
      method: 'PATCH',
      body: { target_user_id: targetUserId, nickname },
    },
  )
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await apiRequest(`/api/workspace/inbox/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  })
}

export function profileName(
  profile: Pick<ProfileRow, 'full_name' | 'display_name' | 'email'> | undefined,
) {
  if (!profile) {
    return 'Unknown user'
  }

  return profile.display_name || profile.full_name || profile.email || 'Workspace user'
}

export function courseLabel(course: Pick<CourseWithMembers, 'code' | 'title'>) {
  return `${course.code} - ${course.title}`
}

export async function fetchConsultationTeachers(): Promise<ConsultationTeacherRow[]> {
  return apiRequest<ConsultationTeacherRow[]>('/api/workspace/help/teachers')
}

export async function fetchHelpRequests(): Promise<HelpRequestRow[]> {
  return apiRequest<HelpRequestRow[]>('/api/workspace/help/requests')
}

export async function submitHelpRequest(input: HelpRequestInput): Promise<HelpRequestRow> {
  return apiRequest<HelpRequestRow>('/api/workspace/help/requests', {
    method: 'POST',
    body: input,
  })
}

export async function fetchTeacherHelpRequests(): Promise<HelpRequestRow[]> {
  return apiRequest<HelpRequestRow[]>('/api/workspace/help/teacher-requests')
}

export async function respondToHelpRequest(
  requestId: string,
  accepted: boolean,
): Promise<HelpRequestRow> {
  return apiRequest<HelpRequestRow>(
    `/api/workspace/help/requests/${encodeURIComponent(requestId)}/respond`,
    {
      method: 'POST',
      body: { accepted },
    },
  )
}

export async function fetchAdminHelpRequests(): Promise<HelpRequestRow[]> {
  return apiRequest<HelpRequestRow[]>('/api/admin/requests')
}

export async function fetchAvailableRoomsForRequest(requestId: string): Promise<RoomRow[]> {
  return apiRequest<RoomRow[]>(
    `/api/admin/requests/${encodeURIComponent(requestId)}/available-rooms`,
  )
}

export async function forwardHelpRequest(requestId: string): Promise<HelpRequestRow> {
  return apiRequest<HelpRequestRow>(
    `/api/admin/requests/${encodeURIComponent(requestId)}/forward`,
    { method: 'POST' },
  )
}

export async function approveHelpRequest(
  requestId: string,
  roomId?: string,
): Promise<HelpRequestRow> {
  return apiRequest<HelpRequestRow>(
    `/api/admin/requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: 'POST',
      body: roomId ? { room_id: roomId } : {},
    },
  )
}

export async function rejectHelpRequest(requestId: string): Promise<HelpRequestRow> {
  return apiRequest<HelpRequestRow>(
    `/api/admin/requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST' },
  )
}

export const CONSULTATION_TOPIC = 'book-consultation'

export const helpTopicPresets = [
  { value: 'course-access', label: 'Course access' },
  { value: 'technical-support', label: 'Technical support' },
  { value: 'study-support', label: 'Study support' },
  { value: CONSULTATION_TOPIC, label: 'Book consultation' },
] as const

export const helpRequestStatusLabel: Record<HelpRequestStatus, string> = {
  submitted: 'Submitted',
  awaiting_teacher: 'With teacher',
  teacher_declined: 'Teacher declined',
  awaiting_room: 'Awaiting room',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function helpTopicLabel(topic: string) {
  const preset = helpTopicPresets.find((entry) => entry.value === topic)
  return preset?.label ?? topic
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
