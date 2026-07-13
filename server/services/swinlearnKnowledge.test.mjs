import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAssignmentsIndexDocument,
  collectAssignmentsFromOffering,
  normalizeSelectedOfferingIds,
  resolveIndexOfferingIds,
} from './swinlearnKnowledge.js'

const offering = {
  assignments: [
    {
      dueAt: new Date('2026-06-25T01:47:00.000Z'),
      title: 'Assignment 1: Create a frontend for health website',
    },
  ],
  course: {
    code: 'COS10004',
    description: 'Computer systems fundamentals.',
    title: 'Computer Systems',
  },
  contentPackages: [
    {
      modules: [
        {
          items: [
            {
              itemType: 'assignment',
              title: 'A1: Ready for Placement',
            },
          ],
          title: 'Assessment',
        },
      ],
    },
  ],
  id: 'offering-cos',
}

test('collectAssignmentsFromOffering gathers workspace and package assignments', () => {
  const assignments = collectAssignmentsFromOffering(offering)

  assert.equal(assignments.length, 2)
  assert.ok(assignments.some((entry) => entry.title.includes('frontend for health website')))
  assert.ok(assignments.some((entry) => entry.title === 'A1: Ready for Placement'))
})

test('buildAssignmentsIndexDocument labels the course explicitly', () => {
  const document = buildAssignmentsIndexDocument(offering)

  assert.equal(document.courseCode, 'COS10004')
  assert.match(document.text, /Course: COS10004 - Computer Systems/)
  assert.match(document.text, /Assignments index:/)
  assert.match(document.text, /Assignment 1: Create a frontend for health website/)
})

test('resolveIndexOfferingIds keeps requested ids that exist and drops unknown ids', async () => {
  const requestedIds = ['offering-a', 'offering-b', 'missing-offering']
  const prisma = {
    courseOffering: {
      findMany: async ({ where }) => ({
        where,
        then: undefined,
        [Symbol.asyncIterator]: undefined,
      }),
    },
  }

  prisma.courseOffering.findMany = async ({ where }) =>
    where.id.in
      .filter((id) => id !== 'missing-offering')
      .map((id) => ({ id }))

  const resolved = await resolveIndexOfferingIds(prisma, requestedIds)

  assert.deepEqual(resolved, ['offering-a', 'offering-b'])
})

test('resolveIndexOfferingIds returns empty array when nothing is requested', async () => {
  const prisma = {
    courseOffering: {
      findMany: async () => {
        throw new Error('should not query when request is empty')
      },
    },
  }

  assert.deepEqual(await resolveIndexOfferingIds(prisma, []), [])
  assert.deepEqual(await resolveIndexOfferingIds(prisma, ['', '  ']), [])
})

test('normalizeSelectedOfferingIds keeps empty selection and filters invalid ids', () => {
  const enrolled = ['off-1', 'off-2']

  assert.deepEqual(normalizeSelectedOfferingIds([], enrolled), [])
  assert.deepEqual(normalizeSelectedOfferingIds(['off-1'], enrolled), ['off-1'])
  assert.deepEqual(normalizeSelectedOfferingIds(['off-1', 'off-1', 'off-3'], enrolled), ['off-1'])
  assert.deepEqual(normalizeSelectedOfferingIds(['off-3'], enrolled), [])
})
