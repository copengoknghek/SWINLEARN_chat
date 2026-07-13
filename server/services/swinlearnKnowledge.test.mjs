import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAssignmentsIndexDocument,
  collectAssignmentsFromOffering,
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
