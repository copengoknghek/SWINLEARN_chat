import assert from 'node:assert/strict'
import test from 'node:test'

import { readAdminUserCreateInput } from './adminUsers.js'

test('teacher creation requires a main major', () => {
  assert.throws(
    () =>
      readAdminUserCreateInput({
        full_name: 'Teacher Demo',
        user_id: 'TCH0001',
        role: 'teacher',
        campus: 'hanoi',
      }),
    {
      statusCode: 400,
      message: 'Teacher profiles require a main major.',
    },
  )
})

test('teacher creation stores a main major and clears student child major', () => {
  assert.deepEqual(
    readAdminUserCreateInput({
      full_name: 'Teacher Demo',
      user_id: 'tch0001',
      role: 'teacher',
      campus: 'danang',
      main_major_id: 'cs',
      child_major_id: 'software',
    }),
    {
      fullName: 'Teacher Demo',
      sourceUserId: 'TCH0001',
      role: 'teacher',
      campus: 'danang',
      email: 'tch0001@swin.edu.au',
      childMajorId: null,
      mainMajorId: 'cs',
    },
  )
})

test('student creation stores a child major and clears teacher main major', () => {
  assert.deepEqual(
    readAdminUserCreateInput({
      full_name: 'Student Demo',
      user_id: 'std0001',
      role: 'student',
      campus: 'hcm',
      main_major_id: 'cs',
      child_major_id: 'software',
    }),
    {
      fullName: 'Student Demo',
      sourceUserId: 'STD0001',
      role: 'student',
      campus: 'hcm',
      email: 'std0001@student.swin.edu.au',
      childMajorId: 'software',
      mainMajorId: null,
    },
  )
})
