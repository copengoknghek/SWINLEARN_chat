import { httpError } from '../http.js'

const MESSAGEABLE_ROLES = new Set(['student', 'teacher'])

export function isMessageableRole(role) {
  return MESSAGEABLE_ROLES.has(role)
}

export function orderPair(id1, id2) {
  return id1 <= id2 ? { userAId: id1, userBId: id2 } : { userAId: id2, userBId: id1 }
}

export function pairKey(id1, id2) {
  const { userAId, userBId } = orderPair(id1, id2)

  return `${userAId}:${userBId}`
}

export function connectionStateFor(currentUserId, connection) {
  if (!connection) {
    return 'none'
  }

  if (connection.status === 'accepted') {
    return 'accepted'
  }

  if (connection.status === 'declined') {
    return 'declined'
  }

  return connection.requestedById === currentUserId ? 'outgoing_pending' : 'incoming_pending'
}

const personSearchClauses = (query) => [
  { displayName: { contains: query } },
  { fullName: { contains: query } },
  { email: { contains: query } },
  { studentId: { contains: query } },
]

export function buildPersonSearchWhere({ currentUserId, memberIds, query = '' }) {
  const trimmedQuery = query.trim()
  const hasMemberScope = Array.isArray(memberIds)
  const scopedMemberIds = hasMemberScope
    ? [...new Set(memberIds)].filter((id) => id !== currentUserId)
    : []
  const where = {
    id: hasMemberScope ? { in: scopedMemberIds } : { not: currentUserId },
    role: { in: ['student', 'teacher'] },
  }

  if (trimmedQuery) {
    where.OR = personSearchClauses(trimmedQuery)
  }

  return where
}

const assertValidTarget = (target, { selfId, verb }) => {
  if (!target) {
    throw httpError(404, 'User was not found.')
  }

  if (target.id === selfId) {
    throw httpError(400, `You cannot ${verb} yourself.`)
  }

  if (!isMessageableRole(target.role)) {
    throw httpError(403, `You cannot ${verb} this user.`)
  }
}

export function assertCanRequestConnection({ requester, addressee, existing }) {
  if (requester.role !== 'student') {
    throw httpError(403, 'Only students need to send connection requests.')
  }

  assertValidTarget(addressee, { selfId: requester.id, verb: 'connect with' })

  if (existing && existing.status === 'accepted') {
    throw httpError(409, 'You are already connected with this user.')
  }

  if (existing && existing.status === 'pending') {
    throw httpError(409, 'A connection request between you two is already pending.')
  }
}

export function assertCanOpenConversation({ sender, target, connection }) {
  if (!isMessageableRole(sender.role)) {
    throw httpError(403, 'Your account cannot start conversations here.')
  }

  assertValidTarget(target, { selfId: sender.id, verb: 'message' })

  if (sender.role === 'teacher') {
    return
  }

  if (!connection || connection.status !== 'accepted') {
    throw httpError(403, 'You can only message people you are connected with.')
  }
}

export const INBOX_COLOR_KEYS = new Set(['green', 'blue', 'purple', 'orange', 'red', 'teal', 'pink'])

export function assertValidInboxColor(color) {
  if (color === null || color === undefined || color === '') {
    return null
  }

  const key = String(color).trim()

  if (!INBOX_COLOR_KEYS.has(key)) {
    throw httpError(400, 'Conversation color is not supported.')
  }

  return key
}

export function assertCanCreateGroup({ creator, memberIds }) {
  if (!isMessageableRole(creator.role)) {
    throw httpError(403, 'Your account cannot create groups.')
  }

  const uniqueIds = [...new Set(memberIds)].filter((id) => id !== creator.id)

  if (uniqueIds.length < 1) {
    throw httpError(400, 'Select at least one member for the group.')
  }

  return uniqueIds
}

export function assertCanAddGroupMember({ creator, member, connection }) {
  assertValidTarget(member, { selfId: creator.id, verb: 'add to a group with' })

  if (creator.role === 'teacher') {
    return
  }

  if (!connection || connection.status !== 'accepted') {
    throw httpError(403, 'You can only add people you are connected with.')
  }
}
