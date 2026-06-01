import { supabase } from '../supabase/client'
import type { Role } from '../../hooks/useAuth'
import type {
  AdminCourseData,
  AdminUserCreateInput,
  AdminUserCreateResult,
  AdminUserImportResult,
  AssignmentMutationInput,
  AssignmentRow,
  AssignmentSubmissionRow,
  CatalogData,
  ChildMajorRow,
  CourseMemberRole,
  CourseMembershipRow,
  CourseMutationInput,
  CourseRow,
  CourseSessionRow,
  CourseWithMembers,
  InboxData,
  InboxMessageRow,
  InboxParticipantRow,
  InboxThreadRow,
  MainMajorRow,
  ManagedUserCredentialRow,
  ProfileRow,
  ProfileCampus,
  ProfileStatus,
} from './types'

type SupabaseErrorLike = {
  message?: string
}

type EdgeFunctionErrorLike = SupabaseErrorLike & {
  context?: unknown
}

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return (error as SupabaseErrorLike).message ?? fallback
  }

  return fallback
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readBodyErrorMessage = (body: unknown) => {
  if (!isRecord(body)) {
    return ''
  }

  const error = body.error ?? body.message

  return typeof error === 'string' ? error : ''
}

const getEdgeFunctionErrorMessage = async (error: unknown) => {
  const fallback = getErrorMessage(error)
  const context = isRecord(error) ? (error as EdgeFunctionErrorLike).context : null

  if (!context || !isRecord(context)) {
    return fallback
  }

  const response = context as unknown as Response

  try {
    const body = await response.clone().json()
    const bodyMessage = readBodyErrorMessage(body)

    if (bodyMessage) {
      return bodyMessage
    }
  } catch {
    try {
      const text = await response.clone().text()

      if (text.trim()) {
        return text
      }
    } catch {
      return fallback
    }
  }

  return fallback
}

const throwIfError = (error: unknown) => {
  if (error) {
    throw new Error(getErrorMessage(error))
  }
}

const byTitle = <T extends { title: string }>(items: T[]) =>
  [...items].sort((first, second) => first.title.localeCompare(second.title))

const mergeCoursesWithMembers = (
  courses: CourseRow[],
  memberships: CourseMembershipRow[],
): CourseWithMembers[] =>
  courses.map((course) => ({
    ...course,
    members: memberships.filter((membership) => membership.course_id === course.id),
  }))

export async function fetchCatalog(): Promise<CatalogData> {
  const [mainMajorsResult, childMajorsResult] = await Promise.all([
    supabase.from('main_majors').select('*').order('sort_order', { ascending: true }),
    supabase.from('child_majors').select('*').order('sort_order', { ascending: true }),
  ])

  throwIfError(mainMajorsResult.error)
  throwIfError(childMajorsResult.error)

  return {
    mainMajors: (mainMajorsResult.data ?? []) as MainMajorRow[],
    childMajors: (childMajorsResult.data ?? []) as ChildMajorRow[],
  }
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id,email,role,full_name,display_name,campus,student_id,must_change_password,status,created_at,updated_at',
    )
    .order('display_name', { ascending: true })

  throwIfError(error)

  return (data ?? []) as ProfileRow[]
}

export async function fetchManagedUserCredentials(): Promise<ManagedUserCredentialRow[]> {
  const { data, error } = await supabase
    .from('managed_user_credentials')
    .select('user_id,temp_password,created_by,created_at')
    .order('created_at', { ascending: false })

  throwIfError(error)

  return (data ?? []) as ManagedUserCredentialRow[]
}

export async function fetchAdminCourseData(): Promise<AdminCourseData> {
  const [catalog, coursesResult, membershipsResult, profiles] = await Promise.all([
    fetchCatalog(),
    supabase.from('courses').select('*').order('code', { ascending: true }),
    supabase.from('course_memberships').select('*'),
    fetchProfiles(),
  ])

  throwIfError(coursesResult.error)
  throwIfError(membershipsResult.error)

  const courses = mergeCoursesWithMembers(
    (coursesResult.data ?? []) as CourseRow[],
    (membershipsResult.data ?? []) as CourseMembershipRow[],
  )

  return {
    ...catalog,
    courses,
    profiles,
  }
}

export async function fetchWorkspaceCourses(): Promise<CourseWithMembers[]> {
  const [coursesResult, membershipsResult] = await Promise.all([
    supabase.from('courses').select('*').order('code', { ascending: true }),
    supabase.from('course_memberships').select('*'),
  ])

  throwIfError(coursesResult.error)
  throwIfError(membershipsResult.error)

  return mergeCoursesWithMembers(
    (coursesResult.data ?? []) as CourseRow[],
    (membershipsResult.data ?? []) as CourseMembershipRow[],
  )
}

export async function createCourseWithTeacher(
  input: CourseMutationInput,
  teacherId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_course_with_teacher', {
    p_child_major_id: input.child_major_id,
    p_code: input.code,
    p_title: input.title,
    p_description: input.description,
    p_semester: input.semester,
    p_academic_year: input.academic_year,
    p_status: input.status,
    p_teacher_id: teacherId,
  })

  throwIfError(error)

  return data as string
}

export async function updateCourse(courseId: string, input: CourseMutationInput) {
  const { error } = await supabase.from('courses').update(input).eq('id', courseId)

  throwIfError(error)
}

export async function deleteCourse(courseId: string) {
  const { error } = await supabase.from('courses').delete().eq('id', courseId)

  throwIfError(error)
}

export async function addCourseMember(courseId: string, userId: string, role: CourseMemberRole) {
  const { error } = await supabase.from('course_memberships').upsert(
    {
      course_id: courseId,
      user_id: userId,
      role,
    },
    { onConflict: 'course_id,user_id' },
  )

  throwIfError(error)
}

export async function removeCourseMember(membershipId: string) {
  const { error } = await supabase.from('course_memberships').delete().eq('id', membershipId)

  throwIfError(error)
}

export async function setTeachingAssistant(courseId: string, userId: string | null) {
  const { error: deleteError } = await supabase
    .from('course_memberships')
    .delete()
    .eq('course_id', courseId)
    .eq('role', 'teaching_assistant')

  throwIfError(deleteError)

  if (userId === null) {
    return
  }

  await addCourseMember(courseId, userId, 'teaching_assistant')
}

export async function updateProfile(
  profileId: string,
  updates: {
    full_name?: string
    display_name?: string
    campus?: ProfileCampus | null
    student_id?: string | null
    role?: Role
    status?: ProfileStatus
  },
) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)

  throwIfError(error)
}

export async function invokeAdminUserAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })

  if (error) {
    const message = await getEdgeFunctionErrorMessage(error)

    if (message.toLowerCase().includes('failed to send a request')) {
      throw new Error(
        'Could not reach the admin-users Edge Function. Deploy admin-users in Supabase Edge Functions and make sure SUPABASE_SERVICE_ROLE_KEY is configured.',
      )
    }

    throw new Error(message)
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error))
  }

  return data
}

export async function createAdminUser(input: AdminUserCreateInput) {
  const data = await invokeAdminUserAction({
    action: 'create',
    ...input,
  })

  return data as AdminUserCreateResult
}

export async function importAdminUsers(records: AdminUserCreateInput[]) {
  const data = await invokeAdminUserAction({
    action: 'import',
    records,
  })

  return (data as { results: AdminUserImportResult[] }).results
}

export async function resetAdminUserPassword(userId: string) {
  const data = await invokeAdminUserAction({
    action: 'reset_password',
    userId,
  })

  return data as {
    success: boolean
    user_id: string
    email: string
    temp_password: string
  }
}

export async function completePasswordChange() {
  const { error } = await supabase.rpc('complete_password_change')

  throwIfError(error)
}

export async function fetchAssignments(): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('due_at', { ascending: true })

  throwIfError(error)

  return (data ?? []) as AssignmentRow[]
}

export async function createAssignment(input: AssignmentMutationInput, userId: string) {
  const { error } = await supabase.from('assignments').insert({
    ...input,
    created_by: userId,
  })

  throwIfError(error)
}

export async function updateAssignment(
  assignmentId: string,
  updates: Partial<AssignmentMutationInput>,
) {
  const { error } = await supabase.from('assignments').update(updates).eq('id', assignmentId)

  throwIfError(error)
}

export async function fetchSubmissions(): Promise<AssignmentSubmissionRow[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })

  throwIfError(error)

  return (data ?? []) as AssignmentSubmissionRow[]
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  body: string,
  files: FileList | null,
) {
  const uploadedPaths: string[] = []

  if (files !== null) {
    for (const file of Array.from(files)) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const filePath = `${assignmentId}/${studentId}/${Date.now()}-${safeFileName}`
      const { error } = await supabase.storage.from('assignment-files').upload(filePath, file, {
        upsert: false,
      })

      throwIfError(error)
      uploadedPaths.push(filePath)
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('assignment_submissions')
    .select('file_paths')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()

  throwIfError(existingError)

  const existingPaths = ((existing?.file_paths ?? []) as string[]).filter(Boolean)

  const { error } = await supabase.from('assignment_submissions').upsert(
    {
      assignment_id: assignmentId,
      student_id: studentId,
      body,
      file_paths: [...existingPaths, ...uploadedPaths],
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'assignment_id,student_id' },
  )

  throwIfError(error)
}

export async function fetchCalendarSessions(): Promise<CourseSessionRow[]> {
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*')
    .order('starts_at', { ascending: true })

  throwIfError(error)

  return (data ?? []) as CourseSessionRow[]
}

export async function fetchInboxData(userId: string): Promise<InboxData> {
  const [profiles, participantResult] = await Promise.all([
    fetchProfiles(),
    supabase.from('inbox_thread_participants').select('*').eq('user_id', userId),
  ])

  throwIfError(participantResult.error)

  const ownParticipants = (participantResult.data ?? []) as InboxParticipantRow[]
  const threadIds = ownParticipants.map((participant) => participant.thread_id)

  if (threadIds.length === 0) {
    return {
      profiles,
      threads: [],
      participants: ownParticipants,
      messages: [],
    }
  }

  const [threadsResult, allParticipantsResult, messagesResult] = await Promise.all([
    supabase.from('inbox_threads').select('*').in('id', threadIds).order('updated_at', {
      ascending: false,
    }),
    supabase.from('inbox_thread_participants').select('*').in('thread_id', threadIds),
    supabase.from('inbox_messages').select('*').in('thread_id', threadIds).order('created_at', {
      ascending: true,
    }),
  ])

  throwIfError(threadsResult.error)
  throwIfError(allParticipantsResult.error)
  throwIfError(messagesResult.error)

  return {
    profiles,
    threads: (threadsResult.data ?? []) as InboxThreadRow[],
    participants: (allParticipantsResult.data ?? []) as InboxParticipantRow[],
    messages: (messagesResult.data ?? []) as InboxMessageRow[],
  }
}

export async function createInboxThread(
  currentUserId: string,
  recipientId: string,
  subject: string,
  messageBody: string,
) {
  const { data: thread, error: threadError } = await supabase
    .from('inbox_threads')
    .insert({
      subject,
      created_by: currentUserId,
    })
    .select('id')
    .single()

  throwIfError(threadError)

  if (!thread) {
    throw new Error('Thread could not be created')
  }

  const threadId = thread.id as string

  const { error: participantError } = await supabase.from('inbox_thread_participants').insert([
    {
      thread_id: threadId,
      user_id: currentUserId,
      last_read_at: new Date().toISOString(),
    },
    {
      thread_id: threadId,
      user_id: recipientId,
      last_read_at: null,
    },
  ])

  throwIfError(participantError)

  const { error: messageError } = await supabase.from('inbox_messages').insert({
    thread_id: threadId,
    sender_id: currentUserId,
    body: messageBody,
  })

  throwIfError(messageError)

  return threadId
}

export async function sendInboxMessage(threadId: string, senderId: string, body: string) {
  const timestamp = new Date().toISOString()
  const [{ error: messageError }, { error: threadError }, { error: participantError }] =
    await Promise.all([
      supabase.from('inbox_messages').insert({
        thread_id: threadId,
        sender_id: senderId,
        body,
      }),
      supabase.from('inbox_threads').update({ updated_at: timestamp }).eq('id', threadId),
      supabase
        .from('inbox_thread_participants')
        .update({ last_read_at: timestamp })
        .eq('thread_id', threadId)
        .eq('user_id', senderId),
    ])

  throwIfError(messageError)
  throwIfError(threadError)
  throwIfError(participantError)
}

export async function markThreadRead(threadId: string, userId: string) {
  const { error } = await supabase
    .from('inbox_thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('user_id', userId)

  throwIfError(error)
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

export function courseLabel(course: Pick<CourseRow, 'code' | 'title'>) {
  return `${course.code} - ${course.title}`
}

export function orderedProfiles(profiles: ProfileRow[]) {
  return byTitle(
    profiles.map((profile) => ({
      ...profile,
      title: profileName(profile),
    })),
  )
}
