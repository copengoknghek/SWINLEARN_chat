import assert from 'node:assert/strict'
import test from 'node:test'

import { deleteCatalogCourse } from './courseDeletion.js'

function createPrismaRecorder() {
  const calls = []
  const record = (name) => async (args) => {
    calls.push({ name, args })
  }
  const transaction = {
    assignmentSubmission: {
      deleteMany: record('assignmentSubmission.deleteMany'),
    },
    assignment: {
      deleteMany: record('assignment.deleteMany'),
    },
    courseSession: {
      deleteMany: record('courseSession.deleteMany'),
    },
    courseStaff: {
      deleteMany: record('courseStaff.deleteMany'),
    },
    enrollment: {
      deleteMany: record('enrollment.deleteMany'),
    },
    studentCourseCompletion: {
      deleteMany: record('studentCourseCompletion.deleteMany'),
    },
    coursePrerequisiteOption: {
      deleteMany: record('coursePrerequisiteOption.deleteMany'),
    },
    coursePrerequisiteGroup: {
      deleteMany: record('coursePrerequisiteGroup.deleteMany'),
    },
    courseOffering: {
      deleteMany: record('courseOffering.deleteMany'),
    },
    curriculumRule: {
      deleteMany: record('curriculumRule.deleteMany'),
    },
    course: {
      delete: record('course.delete'),
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

test('deleteCatalogCourse removes dependent rows before deleting the catalog course', async () => {
  const { calls, prisma } = createPrismaRecorder()

  await deleteCatalogCourse(prisma, 'course-1')

  assert.deepEqual(
    calls.map((call) => call.name),
    [
      '$transaction.start',
      'assignmentSubmission.deleteMany',
      'assignment.deleteMany',
      'courseSession.deleteMany',
      'courseStaff.deleteMany',
      'enrollment.deleteMany',
      'studentCourseCompletion.deleteMany',
      'coursePrerequisiteOption.deleteMany',
      'coursePrerequisiteGroup.deleteMany',
      'courseOffering.deleteMany',
      'curriculumRule.deleteMany',
      'course.delete',
      '$transaction.end',
    ],
  )
  assert.deepEqual(calls.at(-2).args, { where: { id: 'course-1' } })
})

test('deleteCatalogCourse targets rows through the course offering relationship', async () => {
  const { calls, prisma } = createPrismaRecorder()

  await deleteCatalogCourse(prisma, 'course-2')

  assert.deepEqual(calls[1].args, {
    where: {
      assignment: {
        offering: {
          courseId: 'course-2',
        },
      },
    },
  })
  assert.deepEqual(calls[2].args, {
    where: {
      offering: {
        courseId: 'course-2',
      },
    },
  })
  assert.deepEqual(calls[3].args, {
    where: {
      offering: {
        courseId: 'course-2',
      },
    },
  })
  assert.deepEqual(calls[6].args, { where: { courseId: 'course-2' } })
  assert.deepEqual(calls[7].args, {
    where: {
      OR: [
        { requiredCourseId: 'course-2' },
        { group: { courseId: 'course-2' } },
      ],
    },
  })
  assert.deepEqual(calls[8].args, { where: { courseId: 'course-2' } })
  assert.deepEqual(calls[9].args, { where: { courseId: 'course-2' } })
  assert.deepEqual(calls[10].args, { where: { courseId: 'course-2' } })
})
