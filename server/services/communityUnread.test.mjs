import assert from 'node:assert/strict'
import test from 'node:test'

import { countCommunityUnreadByOffering, markCommunityRead } from './communityUnread.js'

const epoch = new Date(0)
const readAt = new Date('2026-06-01T12:00:00.000Z')

function mockPrisma({ cursors = [], postCounts = {}, commentCounts = {} } = {}) {
  return {
    communityReadCursor: {
      findMany: async ({ where }) =>
        cursors.filter(
          (cursor) =>
            cursor.userId === where.userId &&
            where.offeringId.in.includes(cursor.offeringId),
        ),
      upsert: async ({ where, create, update }) => {
        const existing = cursors.find(
          (cursor) =>
            cursor.userId === where.userId_offeringId.userId &&
            cursor.offeringId === where.userId_offeringId.offeringId,
        )

        if (existing) {
          existing.lastReadAt = update.lastReadAt
          return existing
        }

        const created = { id: 'cursor-1', ...create }
        cursors.push(created)
        return created
      },
    },
    communityPost: {
      count: async ({ where }) => postCounts[where.offeringId] ?? 0,
    },
    communityComment: {
      count: async ({ where }) => commentCounts[where.post.offeringId] ?? 0,
    },
  }
}

test('countCommunityUnreadByOffering uses epoch when no cursor exists', async () => {
  const prisma = mockPrisma({
    postCounts: { 'off-1': 2 },
    commentCounts: { 'off-1': 3 },
  })

  const result = await countCommunityUnreadByOffering(prisma, 'user-1', ['off-1'])

  assert.deepEqual(result, {
    'off-1': { posts: 2, comments: 3, total: 5 },
  })
})

test('countCommunityUnreadByOffering returns zero for empty offering list', async () => {
  const result = await countCommunityUnreadByOffering(mockPrisma(), 'user-1', [])

  assert.deepEqual(result, {})
})

test('countCommunityUnreadByOffering passes cursor lastReadAt to count queries', async () => {
  const captured = { postSince: null, commentSince: null }

  const prisma = {
    communityReadCursor: {
      findMany: async () => [
        { userId: 'user-1', offeringId: 'off-1', lastReadAt: readAt },
      ],
    },
    communityPost: {
      count: async ({ where }) => {
        captured.postSince = where.createdAt.gt
        return 4
      },
    },
    communityComment: {
      count: async ({ where }) => {
        captured.commentSince = where.createdAt.gt
        return 1
      },
    },
  }

  const result = await countCommunityUnreadByOffering(prisma, 'user-1', ['off-1'])

  assert.equal(captured.postSince, readAt)
  assert.equal(captured.commentSince, readAt)
  assert.deepEqual(result, {
    'off-1': { posts: 4, comments: 1, total: 5 },
  })
})

test('countCommunityUnreadByOffering excludes own content via query filters', async () => {
  let postWhere
  let commentWhere

  const prisma = {
    communityReadCursor: {
      findMany: async () => [],
    },
    communityPost: {
      count: async ({ where }) => {
        postWhere = where
        return 0
      },
    },
    communityComment: {
      count: async ({ where }) => {
        commentWhere = where
        return 0
      },
    },
  }

  await countCommunityUnreadByOffering(prisma, 'user-1', ['off-1'])

  assert.equal(postWhere.authorId.not, 'user-1')
  assert.equal(postWhere.offeringId, 'off-1')
  assert.deepEqual(postWhere.createdAt, { gt: epoch })
  assert.equal(commentWhere.authorId.not, 'user-1')
  assert.equal(commentWhere.post.offeringId, 'off-1')
  assert.deepEqual(commentWhere.createdAt, { gt: epoch })
})

test('markCommunityRead upserts cursor with current timestamp', async () => {
  const cursors = []
  const prisma = mockPrisma({ cursors })
  const before = Date.now()

  await markCommunityRead(prisma, 'user-1', 'off-1')

  assert.equal(cursors.length, 1)
  assert.equal(cursors[0].userId, 'user-1')
  assert.equal(cursors[0].offeringId, 'off-1')
  assert.ok(cursors[0].lastReadAt.getTime() >= before)

  const firstReadAt = cursors[0].lastReadAt
  await markCommunityRead(prisma, 'user-1', 'off-1')

  assert.equal(cursors.length, 1)
  assert.ok(cursors[0].lastReadAt.getTime() >= firstReadAt.getTime())
})
