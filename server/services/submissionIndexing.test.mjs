import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildSubmissionChunkRecords,
  buildSubmissionSegments,
  indexAssignmentSubmission,
} from './submissionIndexing.js'

const assignment = {
  id: 'asg-1',
  offeringId: 'off-1',
  title: 'Capstone Project',
}

const offering = {
  course: {
    code: 'COS30049',
    title: 'Computing Technology Project',
  },
}

test('buildSubmissionSegments merges body text and GitHub snapshot', async () => {
  const segments = await buildSubmissionSegments({
    assignment,
    fetchGithub: async () => ({
      error: null,
      text: 'Repo: student/demo\n\nREADME\n\nReact portfolio app.',
    }),
    offering,
    submission: {
      body: 'Project link: https://github.com/student/demo',
      filePaths: [],
      studentId: 'student-1',
    },
  })

  assert.equal(segments.error, null)
  assert.equal(segments.segments.length, 1)
  assert.match(segments.segments[0].text, /Capstone Project/)
  assert.match(segments.segments[0].text, /React portfolio/)
  assert.match(segments.segments[0].title, /My project/)
})

test('buildSubmissionSegments reads supported submission files', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'swinlearn-submission-'))
  const filePath = path.join(directory, 'notes.txt')
  await writeFile(filePath, 'Implemented authentication with JWT.')

  const segments = await buildSubmissionSegments({
    assignment,
    offering,
    submission: {
      body: 'See attached notes.',
      filePaths: [filePath],
      studentId: 'student-1',
    },
  })

  assert.match(segments.segments[0].text, /JWT/)
})

test('indexAssignmentSubmission replaces prior vectors on re-submit', async () => {
  const deleted = []
  const upserted = []
  const updates = []

  const prisma = {
    assignmentSubmission: {
      update: async ({ data }) => {
        updates.push(data)
        return data
      },
    },
  }

  await indexAssignmentSubmission({
    assignment,
    embedder: {
      configured: true,
      embed: async (texts) => texts.map(() => [0.1, 0.2]),
    },
    offering,
    prisma,
    studentId: 'student-1',
    submission: {
      body: 'https://github.com/student/demo',
      filePaths: [],
      id: 'sub-1',
      studentId: 'student-1',
    },
    vectorStore: {
      configured: true,
      deleteByFilter: async (filter) => {
        deleted.push(filter)
      },
      upsert: async (points) => {
        upserted.push(points.length)
      },
    },
  })

  assert.equal(deleted.length, 1)
  assert.equal(upserted.length, 1)
  assert.equal(updates.at(-1).indexStatus, 'ready')
})

test('buildSubmissionChunkRecords tags vectors as submission source', () => {
  const records = buildSubmissionChunkRecords([
    {
      locator: {
        assignmentId: 'asg-1',
        assignmentTitle: 'Capstone Project',
        courseCode: 'COS30049',
        offeringId: 'off-1',
        studentId: 'student-1',
      },
      text: 'Course: COS30049\nAssignment submission: Capstone Project',
      title: 'COS30049 / My submission / Capstone Project',
    },
  ])

  assert.equal(records[0].source, 'submission')
  assert.equal(records[0].studentId, 'student-1')
})
