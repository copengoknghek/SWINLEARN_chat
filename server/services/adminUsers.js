import { httpError, requireBodyString } from '../http.js'

const validCampuses = new Set(['hanoi', 'danang', 'hcm'])

const readOptionalString = (input, fieldName) => {
  const value = input[fieldName]

  if (typeof value !== 'string') {
    return null
  }

  return value.trim() || null
}

const readTeacherMainMajorId = (input) => {
  const mainMajorId = readOptionalString(input, 'main_major_id')

  if (!mainMajorId) {
    throw httpError(400, 'Teacher profiles require a main major.')
  }

  return mainMajorId
}

export function readAdminUserCreateInput(input) {
  const fullName = requireBodyString(input, 'full_name')
  const sourceUserId = requireBodyString(input, 'user_id').toUpperCase()
  const role = input.role === 'teacher' ? 'teacher' : 'student'
  const campus = validCampuses.has(input.campus) ? input.campus : 'hanoi'
  const childMajorId = role === 'student' ? readOptionalString(input, 'child_major_id') : null
  const mainMajorId = role === 'teacher' ? readTeacherMainMajorId(input) : null
  const emailDomain = role === 'student' ? 'student.swin.edu.au' : 'swin.edu.au'
  const email = `${sourceUserId.toLowerCase()}@${emailDomain}`

  return {
    fullName,
    sourceUserId,
    role,
    campus,
    email,
    childMajorId,
    mainMajorId,
  }
}
