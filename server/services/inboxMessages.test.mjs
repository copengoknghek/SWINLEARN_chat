import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONNECTION_ACCEPTED_MESSAGE,
  acceptConnectionWithWelcomeMessage,
  assertInboxMessageContent,
  countInboxBadge,
  inboxMessagePreview,
  isConversationUnread,
} from './inboxMessages.js'

test('assertInboxMessageContent allows text, gif, or both', () => {
  assert.deepEqual(assertInboxMessageContent({ body: ' hi ', gifUrl: '' }), {
    body: 'hi',
    gifUrl: null,
  })
  assert.deepEqual(
    assertInboxMessageContent({
      body: '',
      gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
    }),
    {
      body: '',
      gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
    },
  )
  assert.throws(() => assertInboxMessageContent({ body: '   ', gifUrl: '' }), (error) => {
    return error.statusCode === 400
  })
})

test('inboxMessagePreview prefers body over gif marker', () => {
  assert.equal(inboxMessagePreview({ body: 'hello', gifUrl: 'https://x.gif' }), 'hello')
  assert.equal(inboxMessagePreview({ body: '', gifUrl: 'https://x.gif' }), '[GIF]')
  assert.equal(inboxMessagePreview({ body: '', gif_url: 'https://x.gif' }), '[GIF]')
})

test('acceptConnectionWithWelcomeMessage creates thread and welcome message', async () => {
  const operations = []

  const prisma = {
  $transaction: async (callback) => callback(prisma),
  connection: {
    update: async ({ where, data, include }) => {
      operations.push(['connection.update', where.id, data.status])
      return {
        id: where.id,
        status: data.status,
        decidedAt: data.decidedAt,
        requestedById: 'requester-1',
        userAId: 'requester-1',
        userBId: 'accepter-1',
        userA: { id: 'requester-1' },
        userB: { id: 'accepter-1' },
      }
    },
  },
  inboxThread: {
    findUnique: async () => null,
    create: async ({ data }) => {
      operations.push(['inboxThread.create', data.pairKey])
      return { id: 'thread-1', pairKey: data.pairKey }
    },
    update: async ({ where }) => {
      operations.push(['inboxThread.update', where.id])
      return { id: where.id }
    },
  },
  inboxThreadParticipant: {
    updateMany: async () => ({ count: 0 }),
  },
  inboxMessage: {
    create: async ({ data }) => {
      operations.push(['inboxMessage.create', data.senderId, data.body])
      return { id: 'msg-1', ...data }
    },
  },
  }

  const updated = await acceptConnectionWithWelcomeMessage(prisma, {
    connection: { id: 'conn-1', requestedById: 'requester-1' },
    accepterId: 'accepter-1',
  })

  assert.equal(updated.status, 'accepted')
  assert.deepEqual(operations, [
    ['connection.update', 'conn-1', 'accepted'],
    ['inboxThread.create', 'accepter-1:requester-1'],
    ['inboxMessage.create', 'accepter-1', CONNECTION_ACCEPTED_MESSAGE],
    ['inboxThread.update', 'thread-1'],
  ])
})

test('isConversationUnread ignores own messages and respects lastReadAt', () => {
  const lastMessage = {
    senderId: 'other-1',
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
  }

  assert.equal(
    isConversationUnread(
      { lastReadAt: new Date('2026-06-01T11:00:00.000Z') },
      lastMessage,
      'me-1',
    ),
    true,
  )
  assert.equal(
    isConversationUnread(
      { lastReadAt: new Date('2026-06-01T13:00:00.000Z') },
      lastMessage,
      'me-1',
    ),
    false,
  )
  assert.equal(
    isConversationUnread({ lastReadAt: null }, { ...lastMessage, senderId: 'me-1' }, 'me-1'),
    false,
  )
})

test('countInboxBadge totals unread conversations and incoming requests', async () => {
  const prisma = {
    inboxThreadParticipant: {
      findMany: async () => [{ threadId: 'thread-1' }, { threadId: 'thread-2' }],
    },
    inboxThread: {
      findMany: async () => [
        {
          id: 'thread-1',
          participants: [{ userId: 'me-1', lastReadAt: null, hiddenAt: null }],
          messages: [{ senderId: 'other-1', createdAt: new Date('2026-06-01T12:00:00.000Z') }],
        },
        {
          id: 'thread-2',
          participants: [
            {
              userId: 'me-1',
              lastReadAt: new Date('2026-06-01T13:00:00.000Z'),
              hiddenAt: null,
            },
          ],
          messages: [{ senderId: 'other-2', createdAt: new Date('2026-06-01T12:00:00.000Z') }],
        },
      ],
    },
    connection: {
      findMany: async () => [
        { status: 'pending', requestedById: 'other-3' },
        { status: 'pending', requestedById: 'me-1' },
      ],
    },
  }

  assert.deepEqual(await countInboxBadge(prisma, 'me-1'), {
    unread_conversations: 1,
    pending_requests: 1,
    total: 2,
  })
})
