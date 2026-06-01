import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2'

type AdminAction = 'create' | 'import' | 'update' | 'delete' | 'reset_password'
type Role = 'admin' | 'teacher' | 'student'
type CreatableRole = 'teacher' | 'student'
type Status = 'active' | 'inactive'
type Campus = 'hanoi' | 'danang' | 'hcm'

type AdminUserRecord = {
  email?: unknown
  full_name?: unknown
  displayName?: unknown
  role?: unknown
  campus?: unknown
  user_id?: unknown
  student_id?: unknown
}

type AdminUserRequest = AdminUserRecord & {
  action: AdminAction
  records?: AdminUserRecord[]
  userId?: string
  password?: string
  displayName?: string
  fullName?: string
  status?: Status
}

type AuthErrorLike = {
  message?: string
  status?: number
  code?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

const isRole = (value: unknown): value is Role =>
  value === 'admin' || value === 'teacher' || value === 'student'

const isCreatableRole = (value: unknown): value is CreatableRole =>
  value === 'teacher' || value === 'student'

const isStatus = (value: unknown): value is Status =>
  value === 'active' || value === 'inactive'

const isCampus = (value: unknown): value is Campus =>
  value === 'hanoi' || value === 'danang' || value === 'hcm'

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const normalizeNameText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

const normalizeUserId = (value: unknown) => readString(value).toUpperCase().replace(/\s+/g, '')

const isUserId = (value: string) => /^[A-Z]{2,8}\d{3,10}$/.test(value)

const buildGeneratedLocalPart = (fullName: string, userId: string) => {
  const words = fullName
    .trim()
    .split(/\s+/)
    .map(normalizeNameText)
    .filter(Boolean)

  const givenName = words.at(-1) ?? ''
  const initials = words
    .slice(0, -1)
    .map((word) => word[0] ?? '')
    .join('')

  return `${givenName}${initials}${userId.toLowerCase()}`
}

const capitalizeFirst = (value: string) => {
  if (!value) {
    return value
  }

  return `${value[0].toUpperCase()}${value.slice(1)}`
}

const generateEmail = (fullName: string, userId: string) =>
  `${buildGeneratedLocalPart(fullName, userId)}@fpt.edu.vn`

const generateTemporaryPassword = (fullName: string, userId: string) => {
  const localPart = buildGeneratedLocalPart(fullName, userId)

  return `${capitalizeFirst(localPart)}@`
}

const extractUserIdFromEmail = (email: string) => {
  const localPart = email.split('@')[0] ?? ''
  const match = localPart.match(/([a-z]{2,8}\d{3,10})$/i)

  return match?.[1]?.toUpperCase() ?? ''
}

const getGeneratedEmailForRecord = (record: AdminUserRecord) => {
  const fullName = readString(record.full_name) || readString(record.displayName)
  const userId = normalizeUserId(record.user_id) || normalizeUserId(record.student_id)

  if (!fullName || !isUserId(userId)) {
    return ''
  }

  return generateEmail(fullName, userId)
}

const getAuthErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as AuthErrorLike).message ?? 'Unknown error')
  }

  return 'Unknown error'
}

const isEmailAlreadyExistsError = (error: unknown) => {
  const authError = error as AuthErrorLike
  const message = getAuthErrorMessage(error).toLowerCase()

  return (
    authError.status === 409 ||
    authError.status === 422 ||
    authError.code === 'email_exists' ||
    message.includes('already') ||
    message.includes('registered') ||
    message.includes('exists')
  )
}

const normalizeCreateRecord = (record: AdminUserRecord) => {
  const fullName = readString(record.full_name) || readString(record.displayName)
  const role = record.role
  const campus = record.campus
  const userId = normalizeUserId(record.user_id) || normalizeUserId(record.student_id)

  if (!fullName) {
    throw new Error('full_name is required')
  }

  if (!isCreatableRole(role)) {
    throw new Error('role must be student or teacher')
  }

  if (!isCampus(campus)) {
    throw new Error('campus must be hanoi, danang, or hcm')
  }

  if (!isUserId(userId)) {
    throw new Error('user_id must look like SWD00015')
  }

  const email = generateEmail(fullName, userId)

  return {
    email,
    fullName,
    role,
    campus,
    userId,
  }
}

const createManagedUser = async (
  adminClient: ReturnType<typeof createClient>,
  record: AdminUserRecord,
) => {
  const normalized = normalizeCreateRecord(record)
  const tempPassword = generateTemporaryPassword(normalized.fullName, normalized.userId)

  const { data, error } = await adminClient.auth.admin.createUser({
    email: normalized.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: normalized.fullName,
      display_name: normalized.fullName,
      role: normalized.role,
      campus: normalized.campus,
      student_id: normalized.userId,
      must_change_password: true,
    },
  })

  if (error || !data.user) {
    if (isEmailAlreadyExistsError(error)) {
      throw new Error('Email already exists')
    }

    throw new Error(getAuthErrorMessage(error) || 'User could not be created')
  }

  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: data.user.id,
    email: normalized.email,
    role: normalized.role,
    full_name: normalized.fullName,
    display_name: normalized.fullName,
    campus: normalized.campus,
    student_id: normalized.userId,
    must_change_password: true,
    status: 'active',
  })

  if (profileError) {
    throw new Error(profileError.message)
  }

  const { error: credentialError } = await adminClient.from('managed_user_credentials').upsert({
    user_id: data.user.id,
    temp_password: tempPassword,
    created_by: null,
    created_at: new Date().toISOString(),
  })

  if (credentialError) {
    throw new Error(credentialError.message)
  }

  return {
    success: true,
    user_id: data.user.id,
    email: normalized.email,
    temp_password: tempPassword,
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase function environment is not configured' }, 500)
  }

  const authorization = request.headers.get('Authorization') ?? ''

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    return jsonResponse({ error: 'Admin access is required' }, 403)
  }

  let payload: AdminUserRequest

  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  if (payload.action === 'create') {
    try {
      const result = await createManagedUser(adminClient, payload)
      await adminClient
        .from('managed_user_credentials')
        .update({ created_by: user.id })
        .eq('user_id', result.user_id)

      return jsonResponse(result)
    } catch (createError) {
      return jsonResponse({ error: getAuthErrorMessage(createError) }, 400)
    }
  }

  if (payload.action === 'import') {
    const records = Array.isArray(payload.records) ? payload.records : []

    if (records.length === 0) {
      return jsonResponse({ error: 'CSV import has no valid rows' }, 400)
    }

    const results = []

    for (const [index, record] of records.entries()) {
      try {
        const result = await createManagedUser(adminClient, record)
        await adminClient
          .from('managed_user_credentials')
          .update({ created_by: user.id })
          .eq('user_id', result.user_id)
        results.push({
          row: index + 2,
          ...result,
        })
      } catch (importError) {
        results.push({
          row: index + 2,
          email: getGeneratedEmailForRecord(record),
          success: false,
          error: getAuthErrorMessage(importError),
        })
      }
    }

    return jsonResponse({ results })
  }

  if (payload.action === 'reset_password') {
    if (!payload.userId) {
      return jsonResponse({ error: 'User id is required' }, 400)
    }

    const { data: resetProfile, error: resetProfileError } = await adminClient
      .from('profiles')
      .select('email,full_name,display_name,student_id')
      .eq('id', payload.userId)
      .maybeSingle()

    if (resetProfileError || !resetProfile?.email) {
      return jsonResponse({ error: resetProfileError?.message ?? 'User profile was not found' }, 400)
    }

    const resetUserId =
      normalizeUserId(resetProfile.student_id) || extractUserIdFromEmail(resetProfile.email)

    if (!isUserId(resetUserId)) {
      return jsonResponse({ error: 'User ID is required before resetting this password' }, 400)
    }

    const tempPassword = generateTemporaryPassword(
      resetProfile.full_name ?? resetProfile.display_name ?? resetProfile.email.split('@')[0],
      resetUserId,
    )
    const { data, error } = await adminClient.auth.admin.updateUserById(payload.userId, {
      password: tempPassword,
      user_metadata: {
        must_change_password: true,
      },
    })

    if (error || !data.user) {
      return jsonResponse({ error: error?.message ?? 'Password could not be reset' }, 400)
    }

    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', payload.userId)
      .select('email')
      .maybeSingle()

    if (profileUpdateError) {
      return jsonResponse({ error: profileUpdateError.message }, 400)
    }

    const { error: credentialError } = await adminClient.from('managed_user_credentials').upsert({
      user_id: payload.userId,
      temp_password: tempPassword,
      created_by: user.id,
      created_at: new Date().toISOString(),
    })

    if (credentialError) {
      return jsonResponse({ error: credentialError.message }, 400)
    }

    return jsonResponse({
      success: true,
      user_id: payload.userId,
      email: updatedProfile?.email ?? data.user.email ?? '',
      temp_password: tempPassword,
    })
  }

  if (payload.action === 'update') {
    if (!payload.userId) {
      return jsonResponse({ error: 'User id is required' }, 400)
    }

    const profileUpdates: Record<string, string | boolean | null> = {}
    const displayName = readString(payload.displayName)
    const fullName = readString(payload.fullName)
    const userId = normalizeUserId(payload.user_id) || normalizeUserId(payload.student_id)

    if (displayName) {
      profileUpdates.display_name = displayName
    }

    if (fullName) {
      profileUpdates.full_name = fullName
    }

    if (payload.email !== undefined) {
      profileUpdates.email = readString(payload.email).toLowerCase()
    }

    if (isRole(payload.role)) {
      profileUpdates.role = payload.role
    }

    if (isCampus(payload.campus)) {
      profileUpdates.campus = payload.campus
    }

    if (payload.user_id !== undefined || payload.student_id !== undefined) {
      profileUpdates.student_id = userId || null
    }

    if (isStatus(payload.status)) {
      profileUpdates.status = payload.status
    }

    if (payload.email || payload.password) {
      const { error } = await adminClient.auth.admin.updateUserById(payload.userId, {
        email: readString(payload.email) || undefined,
        password: payload.password,
      })

      if (error) {
        return jsonResponse({ error: error.message }, 400)
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', payload.userId)

      if (error) {
        return jsonResponse({ error: error.message }, 400)
      }
    }

    return jsonResponse({ ok: true })
  }

  if (payload.action === 'delete') {
    if (!payload.userId) {
      return jsonResponse({ error: 'User id is required' }, 400)
    }

    if (payload.userId === user.id) {
      return jsonResponse({ error: 'Admins cannot delete their own account here' }, 400)
    }

    const { error } = await adminClient.auth.admin.deleteUser(payload.userId)

    if (error) {
      return jsonResponse({ error: error.message }, 400)
    }

    return jsonResponse({ ok: true })
  }

  return jsonResponse({ error: 'Unknown admin action' }, 400)
})
