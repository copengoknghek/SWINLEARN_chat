import assert from 'node:assert/strict'
import test from 'node:test'

import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  submitRegistrationRequests,
} from './registrationRequests.js'

const student = {
  id: 'student-1',
  role: 'student',
  child_major_id: 'software-development',
}

const baseOffering = {
  id: 'offering-intro-s1',
  catalog_course_id: 'intro-programming',
  term: 'semester_1',
  academic_year: 2026,
}

const baseContext = {
  student,
  childMajors: [
    {
      id: 'software-development',
      main_major_id: 'cs',
      title: 'Software Development',
      summary: '',
      sort_order: 1,
    },
  ],
  courses: [
    {
      id: 'intro-programming',
      code: 'COS10009',
      title: 'Introduction to Programming',
      description: '',
      credit_points: 12.5,
    },
  ],
  curriculumRules: [
    {
      id: 'rule-intro',
      course_id: 'intro-programming',
      rule_type: 'core',
      scope: 'main_major',
      scope_key: 'cs',
      main_major_id: 'cs',
      child_major_id: null,
    },
  ],
  prerequisiteGroups: [],
  prerequisiteOptions: [],
  completions: [],
  enrollments: [],
  offerings: [baseOffering],
}

const transactionRecorder = () => {
  const calls = []
  const prismaClient = {
    calls,
    courseRegistrationRequest: {
      upsert(args) {
        calls.push(['request.upsert', args])
        return { operation: 'request.upsert', args }
      },
      findUnique(args) {
        calls.push(['request.findUnique', args])
        return {
          id: 'request-1',
          offeringId: baseOffering.id,
          userId: student.id,
          status: 'pending',
        }
      },
      update(args) {
        calls.push(['request.update', args])
        return { operation: 'request.update', args }
      },
    },
    enrollment: {
      upsert(args) {
        calls.push(['enrollment.upsert', args])
        return { operation: 'enrollment.upsert', args }
      },
    },
    $transaction(operations) {
      calls.push(['transaction', operations])
      return operations
    },
  }

  return prismaClient
}

test('student registration creates pending requests instead of enrollments', async () => {
  const prismaClient = transactionRecorder()

  const result = await submitRegistrationRequests(prismaClient, {
    studentId: student.id,
    offeringIds: [baseOffering.id],
    context: baseContext,
  })

  assert.equal(result.requested_count, 1)
  assert.deepEqual(
    prismaClient.calls.map(([name]) => name),
    ['request.upsert', 'transaction'],
  )
  assert.equal(prismaClient.calls[0][1].create.status, 'pending')
  assert.equal(prismaClient.calls[0][1].update.status, 'pending')
})

test('rejected registration can be retried as pending with cleared decision fields', async () => {
  const prismaClient = transactionRecorder()

  await submitRegistrationRequests(prismaClient, {
    studentId: student.id,
    offeringIds: [baseOffering.id],
    context: baseContext,
  })

  assert.equal(prismaClient.calls[0][1].update.status, 'pending')
  assert.equal(prismaClient.calls[0][1].update.decidedAt, null)
  assert.equal(prismaClient.calls[0][1].update.decidedById, null)
  assert.ok(prismaClient.calls[0][1].update.requestedAt instanceof Date)
})

test('student registration rejects ineligible offerings before creating pending requests', async () => {
  const prismaClient = transactionRecorder()
  const blockedContext = {
    ...baseContext,
    prerequisiteGroups: [
      {
        id: 'credits-25',
        course_id: 'intro-programming',
        requirement_type: 'completed_credit_points',
        minimum_credit_points: 25,
        sort_order: 0,
      },
    ],
  }

  await assert.rejects(
    submitRegistrationRequests(prismaClient, {
      studentId: student.id,
      offeringIds: [baseOffering.id],
      context: blockedContext,
    }),
    /not allowed to request approval/,
  )
  assert.deepEqual(prismaClient.calls, [])
})

test('approving a pending registration creates enrollment and marks request approved', async () => {
  const prismaClient = transactionRecorder()

  await approveRegistrationRequest(prismaClient, {
    requestId: 'request-1',
    adminId: 'admin-1',
    loadContext: async () => baseContext,
  })

  assert.deepEqual(
    prismaClient.calls.map(([name]) => name),
    ['request.findUnique', 'enrollment.upsert', 'request.update', 'transaction'],
  )
  assert.deepEqual(prismaClient.calls[1][1].where.offeringId_userId, {
    offeringId: baseOffering.id,
    userId: student.id,
  })
  assert.equal(prismaClient.calls[2][1].data.status, 'approved')
  assert.equal(prismaClient.calls[2][1].data.decidedById, 'admin-1')
  assert.ok(prismaClient.calls[2][1].data.decidedAt instanceof Date)
})

test('rejecting a pending registration marks the request rejected without enrollment', async () => {
  const prismaClient = transactionRecorder()

  await rejectRegistrationRequest(prismaClient, {
    requestId: 'request-1',
    adminId: 'admin-1',
  })

  assert.deepEqual(
    prismaClient.calls.map(([name]) => name),
    ['request.update'],
  )
  assert.equal(prismaClient.calls[0][1].data.status, 'rejected')
  assert.equal(prismaClient.calls[0][1].data.decidedById, 'admin-1')
  assert.ok(prismaClient.calls[0][1].data.decidedAt instanceof Date)
})

test('approval re-checks prerequisites before granting enrollment', async () => {
  const prismaClient = transactionRecorder()
  const blockedContext = {
    ...baseContext,
    prerequisiteGroups: [
      {
        id: 'credits-25',
        course_id: 'intro-programming',
        requirement_type: 'completed_credit_points',
        minimum_credit_points: 25,
        sort_order: 0,
      },
    ],
  }

  await assert.rejects(
    approveRegistrationRequest(prismaClient, {
      requestId: 'request-1',
      adminId: 'admin-1',
      loadContext: async () => blockedContext,
    }),
    /Need 25 completed credit points/,
  )
  assert.deepEqual(
    prismaClient.calls.map(([name]) => name),
    ['request.findUnique'],
  )
})
