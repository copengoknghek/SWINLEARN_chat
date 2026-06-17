import assert from 'node:assert/strict'
import test from 'node:test'

import { createCatalogCourseWithRule } from './courseCreation.js'

function createPrismaRecorder() {
  const calls = []
  const transaction = {
    course: {
      create: async (args) => {
        calls.push({ name: 'course.create', args })

        return {
          id: 'course-created',
          ...args.data,
        }
      },
    },
    curriculumRule: {
      create: async (args) => {
        calls.push({ name: 'curriculumRule.create', args })

        return {
          id: 'rule-created',
          ...args.data,
        }
      },
    },
  }
  const prisma = {
    $transaction: async (callback) => {
      calls.push({ name: '$transaction.start' })
      const result = await callback(transaction)
      calls.push({ name: '$transaction.end' })

      return result
    },
  }

  return { calls, prisma }
}

test('createCatalogCourseWithRule requires a curriculum rule', async () => {
  const { prisma } = createPrismaRecorder()

  await assert.rejects(
    () =>
      createCatalogCourseWithRule(
        prisma,
        {
          code: 'COS10009',
          title: 'Introduction to Programming',
          description: 'Programming fundamentals',
        },
        'admin-1',
      ),
    {
      statusCode: 400,
      message: 'A curriculum rule is required before creating a catalog course.',
    },
  )
})

test('createCatalogCourseWithRule creates the course and its curriculum rule atomically', async () => {
  const { calls, prisma } = createPrismaRecorder()

  const course = await createCatalogCourseWithRule(
    prisma,
    {
      code: ' cos10009 ',
      title: ' Introduction to Programming ',
      description: '  Programming fundamentals  ',
      curriculum_rule: {
        rule_type: 'major',
        scope: 'child_major',
        main_major_id: null,
        child_major_id: 'child-ai',
      },
    },
    'admin-1',
  )

  assert.equal(course.id, 'course-created')
  assert.deepEqual(
    calls.map((call) => call.name),
    ['$transaction.start', 'course.create', 'curriculumRule.create', '$transaction.end'],
  )
  assert.deepEqual(calls[1].args, {
    data: {
      code: 'COS10009',
      title: 'Introduction to Programming',
      description: 'Programming fundamentals',
      creditPoints: 12.5,
      createdById: 'admin-1',
    },
  })
  assert.deepEqual(calls[2].args, {
    data: {
      courseId: 'course-created',
      ruleType: 'major',
      scope: 'child_major',
      scopeKey: 'child-ai',
      mainMajorId: null,
      childMajorId: 'child-ai',
    },
  })
})

test('createCatalogCourseWithRule accepts explicit course credit points', async () => {
  const { calls, prisma } = createPrismaRecorder()

  await createCatalogCourseWithRule(
    prisma,
    {
      code: 'COS30099',
      title: 'Advanced Project',
      description: 'Capstone work',
      credit_points: 25,
      curriculum_rule: {
        rule_type: 'major',
        scope: 'child_major',
        main_major_id: null,
        child_major_id: 'child-ai',
      },
    },
    'admin-1',
  )

  assert.equal(calls[1].args.data.creditPoints, 25)
})
