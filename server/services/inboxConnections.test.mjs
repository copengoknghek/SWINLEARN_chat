import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertCanAddGroupMember,
  assertCanCreateGroup,
  assertCanOpenConversation,
  assertCanRequestConnection,
  assertValidInboxColor,
  buildPersonSearchWhere,
  connectionStateFor,
  isMessageableRole,
  orderPair,
  pairKey,
} from './inboxConnections.js'

const student = (id, overrides = {}) => ({ id, role: 'student', status: 'active', ...overrides })
const teacher = (id, overrides = {}) => ({ id, role: 'teacher', status: 'active', ...overrides })
const admin = (id, overrides = {}) => ({ id, role: 'admin', status: 'active', ...overrides })

const throwsWithStatus = (fn, statusCode) =>
  assert.throws(fn, (error) => error.statusCode === statusCode)

test('orderPair sorts ids deterministically regardless of input order', () => {
  assert.deepEqual(orderPair('bbb', 'aaa'), { userAId: 'aaa', userBId: 'bbb' })
  assert.deepEqual(orderPair('aaa', 'bbb'), { userAId: 'aaa', userBId: 'bbb' })
})

test('pairKey is symmetric and sorted', () => {
  assert.equal(pairKey('zoe', 'amy'), 'amy:zoe')
  assert.equal(pairKey('amy', 'zoe'), 'amy:zoe')
})

test('isMessageableRole excludes admins', () => {
  assert.equal(isMessageableRole('student'), true)
  assert.equal(isMessageableRole('teacher'), true)
  assert.equal(isMessageableRole('admin'), false)
})

test('connectionStateFor reports state from the current user perspective', () => {
  assert.equal(connectionStateFor('u1', null), 'none')
  assert.equal(
    connectionStateFor('u1', { status: 'accepted', requestedById: 'u2' }),
    'accepted',
  )
  assert.equal(
    connectionStateFor('u1', { status: 'declined', requestedById: 'u1' }),
    'declined',
  )
  assert.equal(
    connectionStateFor('u1', { status: 'pending', requestedById: 'u1' }),
    'outgoing_pending',
  )
  assert.equal(
    connectionStateFor('u1', { status: 'pending', requestedById: 'u2' }),
    'incoming_pending',
  )
})

test('buildPersonSearchWhere searches all messageable people by text when no course is selected', () => {
  assert.deepEqual(buildPersonSearchWhere({ currentUserId: 'current', query: ' Thinh ' }), {
    id: { not: 'current' },
    role: { in: ['student', 'teacher'] },
    OR: [
      { displayName: { contains: 'Thinh' } },
      { fullName: { contains: 'Thinh' } },
      { email: { contains: 'Thinh' } },
      { studentId: { contains: 'Thinh' } },
    ],
  })
})

test('buildPersonSearchWhere lists every messageable course member when only a course is selected', () => {
  assert.deepEqual(
    buildPersonSearchWhere({
      currentUserId: 'current',
      memberIds: ['current', 'thinh', 'mai'],
      query: '',
    }),
    {
      id: { in: ['thinh', 'mai'] },
      role: { in: ['student', 'teacher'] },
    },
  )
})

test('buildPersonSearchWhere intersects text search with selected course members', () => {
  assert.deepEqual(
    buildPersonSearchWhere({
      currentUserId: 'current',
      memberIds: ['thinh-other-course', 'mai-in-course'],
      query: 'Thinh',
    }),
    {
      id: { in: ['thinh-other-course', 'mai-in-course'] },
      role: { in: ['student', 'teacher'] },
      OR: [
        { displayName: { contains: 'Thinh' } },
        { fullName: { contains: 'Thinh' } },
        { email: { contains: 'Thinh' } },
        { studentId: { contains: 'Thinh' } },
      ],
    },
  )
})

test('assertCanRequestConnection allows a student to request another active student or teacher', () => {
  assert.doesNotThrow(() =>
    assertCanRequestConnection({ requester: student('s1'), addressee: student('s2'), existing: null }),
  )
  assert.doesNotThrow(() =>
    assertCanRequestConnection({ requester: student('s1'), addressee: teacher('t1'), existing: null }),
  )
})

test('assertCanRequestConnection allows re-requesting after a previous decline', () => {
  assert.doesNotThrow(() =>
    assertCanRequestConnection({
      requester: student('s1'),
      addressee: student('s2'),
      existing: { status: 'declined', requestedById: 's1' },
    }),
  )
})

test('assertCanRequestConnection blocks non-students from initiating', () => {
  throwsWithStatus(
    () => assertCanRequestConnection({ requester: teacher('t1'), addressee: student('s1'), existing: null }),
    403,
  )
})

test('assertCanRequestConnection blocks admin, self, and missing addressees', () => {
  throwsWithStatus(
    () => assertCanRequestConnection({ requester: student('s1'), addressee: admin('a1'), existing: null }),
    403,
  )
  throwsWithStatus(
    () => assertCanRequestConnection({ requester: student('s1'), addressee: student('s1'), existing: null }),
    400,
  )
  throwsWithStatus(
    () => assertCanRequestConnection({ requester: student('s1'), addressee: null, existing: null }),
    404,
  )
})

test('assertCanRequestConnection blocks duplicate pending or already-accepted connections', () => {
  throwsWithStatus(
    () =>
      assertCanRequestConnection({
        requester: student('s1'),
        addressee: student('s2'),
        existing: { status: 'pending', requestedById: 's1' },
      }),
    409,
  )
  throwsWithStatus(
    () =>
      assertCanRequestConnection({
        requester: student('s1'),
        addressee: student('s2'),
        existing: { status: 'accepted', requestedById: 's2' },
      }),
    409,
  )
})

test('assertCanOpenConversation lets teachers message any active student or teacher', () => {
  assert.doesNotThrow(() =>
    assertCanOpenConversation({ sender: teacher('t1'), target: student('s1'), connection: null }),
  )
  assert.doesNotThrow(() =>
    assertCanOpenConversation({ sender: teacher('t1'), target: teacher('t2'), connection: null }),
  )
})

test('assertCanOpenConversation requires students to have an accepted connection', () => {
  throwsWithStatus(
    () => assertCanOpenConversation({ sender: student('s1'), target: student('s2'), connection: null }),
    403,
  )
  throwsWithStatus(
    () =>
      assertCanOpenConversation({
        sender: student('s1'),
        target: student('s2'),
        connection: { status: 'pending', requestedById: 's1' },
      }),
    403,
  )
  assert.doesNotThrow(() =>
    assertCanOpenConversation({
      sender: student('s1'),
      target: student('s2'),
      connection: { status: 'accepted', requestedById: 's2' },
    }),
  )
})

test('assertCanOpenConversation gates student-to-teacher chats behind acceptance too', () => {
  throwsWithStatus(
    () => assertCanOpenConversation({ sender: student('s1'), target: teacher('t1'), connection: null }),
    403,
  )
  assert.doesNotThrow(() =>
    assertCanOpenConversation({
      sender: student('s1'),
      target: teacher('t1'),
      connection: { status: 'accepted', requestedById: 's1' },
    }),
  )
})

test('assertCanOpenConversation never allows admins as sender or target', () => {
  throwsWithStatus(
    () => assertCanOpenConversation({ sender: teacher('t1'), target: admin('a1'), connection: null }),
    403,
  )
  throwsWithStatus(
    () => assertCanOpenConversation({ sender: admin('a1'), target: student('s1'), connection: null }),
    403,
  )
})

test('assertCanOpenConversation blocks self targets', () => {
  throwsWithStatus(
    () => assertCanOpenConversation({ sender: student('s1'), target: student('s1'), connection: null }),
    400,
  )
  assert.doesNotThrow(() =>
    assertCanOpenConversation({
      sender: teacher('t1'),
      target: student('s1', { status: 'inactive' }),
      connection: null,
    }),
  )
})

test('assertCanCreateGroup requires at least one other member', () => {
  throwsWithStatus(
    () => assertCanCreateGroup({ creator: student('s1'), memberIds: ['s1'] }),
    400,
  )
  assert.deepEqual(assertCanCreateGroup({ creator: student('s1'), memberIds: ['s1', 's2', 's2'] }), [
    's2',
  ])
})

test('assertCanAddGroupMember requires accepted connections for students', () => {
  assert.doesNotThrow(() =>
    assertCanAddGroupMember({
      creator: teacher('t1'),
      member: student('s1'),
      connection: null,
    }),
  )
  assert.doesNotThrow(() =>
    assertCanAddGroupMember({
      creator: student('s1'),
      member: student('s2'),
      connection: { status: 'accepted', requestedById: 's2' },
    }),
  )
  throwsWithStatus(
    () =>
      assertCanAddGroupMember({
        creator: student('s1'),
        member: student('s2'),
        connection: null,
      }),
    403,
  )
})

test('assertValidInboxColor accepts supported keys and clears empty values', () => {
  assert.equal(assertValidInboxColor(null), null)
  assert.equal(assertValidInboxColor(''), null)
  assert.equal(assertValidInboxColor('purple'), 'purple')
  throwsWithStatus(() => assertValidInboxColor('gold'), 400)
})
