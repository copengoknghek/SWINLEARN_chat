import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2'

type CreateUserRole = 'student' | 'teacher'
type Campus = 'hanoi' | 'danang' | 'hcm'

type CreateUserRequest = {
  full_name?: unknown
  role?: unknown
  campus?: unknown
  user_id?: unknown
  student_id?: unknown
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

const isCreateUserRole = (value: unknown): value is CreateUserRole =>
  value === 'student' || value === 'teacher'

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

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase function environment is not configured' }, 500)
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)
  const accessToken = bearerMatch?.[1]?.trim()

  if (!accessToken) {
    return jsonResponse({ error: 'Authentication token is required' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await adminClient.auth.getUser(accessToken)

  if (callerError || !caller) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500)
  }

  if (callerProfile?.role !== 'admin') {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  let payload: CreateUserRequest

  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const fullName = readString(payload.full_name)
  const role = payload.role
  const campus = payload.campus
  const userId = normalizeUserId(payload.user_id) || normalizeUserId(payload.student_id)

  if (!fullName) {
    return jsonResponse({ error: 'full_name is required' }, 400)
  }

  if (!isCreateUserRole(role)) {
    return jsonResponse({ error: 'role must be student or teacher' }, 400)
  }

  if (!isCampus(campus)) {
    return jsonResponse({ error: 'campus must be hanoi, danang, or hcm' }, 400)
  }

  if (!isUserId(userId)) {
    return jsonResponse({ error: 'user_id must look like SWD00015' }, 400)
  }

  const email = generateEmail(fullName, userId)
  const tempPassword = generateTemporaryPassword(fullName, userId)

  const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      display_name: fullName,
      role,
      campus,
      student_id: userId,
      must_change_password: true,
    },
  })

  if (createUserError || !createdUserData.user) {
    if (isEmailAlreadyExistsError(createUserError)) {
      return jsonResponse({ error: 'Email already exists' }, 409)
    }

    return jsonResponse(
      { error: getAuthErrorMessage(createUserError) || 'User could not be created' },
      500,
    )
  }

  const { error: profileErrorAfterCreate } = await adminClient.from('profiles').upsert({
    id: createdUserData.user.id,
    email,
    role,
    full_name: fullName,
    display_name: fullName,
    campus,
    student_id: userId,
    must_change_password: true,
    status: 'active',
  })

  if (profileErrorAfterCreate) {
    return jsonResponse({ error: profileErrorAfterCreate.message }, 500)
  }

  const { error: credentialError } = await adminClient.from('managed_user_credentials').upsert({
    user_id: createdUserData.user.id,
    temp_password: tempPassword,
    created_by: caller.id,
    created_at: new Date().toISOString(),
  })

  if (credentialError) {
    return jsonResponse({ error: credentialError.message }, 500)
  }

  return jsonResponse({
    success: true,
    user_id: createdUserData.user.id,
    email,
    temp_password: tempPassword,
  })
})
