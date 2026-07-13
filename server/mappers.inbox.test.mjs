import assert from 'node:assert/strict'
import test from 'node:test'

import { isThreadVisible, mapConversation } from './mappers.js'

const user = (id, name) => ({
  id,
  email: `${id}@example.com`,
  role: 'student',
  fullName: name,
  displayName: name,
  avatarUrl: null,
  campus: null,
  studentId: null,
  mainMajorId: null,
  childMajorId: null,
  mustChangePassword: false,
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
})

test('mapConversation applies shared nicknames for direct messages', () => {
  const mapped = mapConversation(
    {
      id: 'thread-1',
      subject: '',
      isGroup: false,
      color: 'purple',
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      participants: [
        {
          userId: 'me',
          nickname: null,
          lastReadAt: new Date('2026-06-01T00:00:00.000Z'),
          user: user('me', 'Me'),
        },
        {
          userId: 'friend',
          nickname: 'Bestie',
          lastReadAt: null,
          user: user('friend', 'Friend Name'),
        },
      ],
      messages: [
        {
          id: 'msg-1',
          threadId: 'thread-1',
          senderId: 'friend',
          body: 'Hello',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
    },
    'me',
  )

  assert.equal(mapped.name, 'Bestie')
  assert.equal(mapped.color, 'purple')
  assert.equal(mapped.other_user.display_name, 'Bestie')
  assert.equal(mapped.participants[1].nickname, 'Bestie')
})

test('mapConversation maps group metadata and participant list', () => {
  const mapped = mapConversation(
    {
      id: 'group-1',
      subject: 'Study Group',
      isGroup: true,
      color: null,
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      participants: [
        {
          userId: 'me',
          nickname: null,
          lastReadAt: new Date('2026-06-01T00:00:00.000Z'),
          user: user('me', 'Me'),
        },
        {
          userId: 'friend',
          nickname: null,
          lastReadAt: null,
          user: user('friend', 'Friend Name'),
        },
      ],
      messages: [],
    },
    'me',
  )

  assert.equal(mapped.is_group, true)
  assert.equal(mapped.name, 'Study Group')
  assert.equal(mapped.participants.length, 2)
  assert.equal(mapped.other_user, null)
})

test('isThreadVisible hides conversations until a newer message arrives', () => {
  const messages = [
    {
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
    },
    {
      createdAt: new Date('2026-06-01T12:00:00.000Z'),
    },
  ]

  assert.equal(
    isThreadVisible({ hiddenAt: new Date('2026-06-01T11:00:00.000Z') }, messages),
    true,
  )
  assert.equal(
    isThreadVisible({ hiddenAt: new Date('2026-06-01T13:00:00.000Z') }, messages),
    false,
  )
})
