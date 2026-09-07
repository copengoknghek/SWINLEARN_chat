import { assertGifUrl } from './community.js'
import { connectionStateFor, pairKey } from './inboxConnections.js'
import { isThreadVisible } from '../mappers.js'

export const CONNECTION_ACCEPTED_MESSAGE =
  'I accepted your connection request. You can message me anytime.'

export const assertInboxMessageContent = ({ body, gifUrl }) => {
  const trimmedBody = String(body ?? '').trim()
  const normalizedGifUrl = assertGifUrl(gifUrl)

  if (!trimmedBody && !normalizedGifUrl) {
    const error = new Error('Add text or a GIF.')
    error.statusCode = 400
    throw error
  }

  return {
    body: trimmedBody,
    gifUrl: normalizedGifUrl,
  }
}

export const inboxMessagePreview = (message) => {
  const body = String(message?.body ?? '').trim()

  if (body) {
    return body
  }

  if (message?.gifUrl || message?.gif_url) {
    return '[GIF]'
  }

  return ''
}

export async function ensureDirectConversation(prisma, userId1, userId2) {
  const key = pairKey(userId1, userId2)
  const existing = await prisma.inboxThread.findUnique({ where: { pairKey: key } })

  if (existing) {
    await prisma.inboxThreadParticipant.updateMany({
      where: {
        threadId: existing.id,
        userId: { in: [userId1, userId2] },
      },
      data: { hiddenAt: null },
    })

    return { thread: existing, created: false }
  }

  const thread = await prisma.inboxThread.create({
    data: {
      subject: '',
      pairKey: key,
      createdById: userId1,
      participants: {
        create: [{ userId: userId1, lastReadAt: new Date() }, { userId: userId2 }],
      },
    },
  })

  return { thread, created: true }
}

export async function acceptConnectionWithWelcomeMessage(prisma, { connection, accepterId }) {
  const requesterId = connection.requestedById
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const updated = await tx.connection.update({
      where: { id: connection.id },
      data: { status: 'accepted', decidedAt: now },
      include: { userA: true, userB: true },
    })

    const thread = await ensureDirectConversation(tx, accepterId, requesterId)

    await tx.inboxMessage.create({
      data: {
        threadId: thread.thread.id,
        senderId: accepterId,
        body: CONNECTION_ACCEPTED_MESSAGE,
      },
    })

    await tx.inboxThread.update({
      where: { id: thread.thread.id },
      data: { updatedAt: now },
    })

    return updated
  })
}

export function isConversationUnread(participant, lastMessage, currentUserId) {
  if (!participant || !lastMessage) {
    return false
  }

  const lastReadAt = participant.lastReadAt ? new Date(participant.lastReadAt) : null
  const createdAt = new Date(lastMessage.createdAt ?? lastMessage.created_at)

  const senderId = lastMessage.senderId ?? lastMessage.sender_id

  return (
    senderId !== currentUserId &&
    (!lastReadAt || createdAt > lastReadAt)
  )
}

export async function countInboxBadge(prisma, currentUserId) {
  const ownParticipants = await prisma.inboxThreadParticipant.findMany({
    where: { userId: currentUserId },
    select: { threadId: true },
  })
  const threadIds = ownParticipants.map((participant) => participant.threadId)

  const [threads, connections] = await Promise.all([
    threadIds.length
      ? prisma.inboxThread.findMany({
          where: { id: { in: threadIds } },
          include: {
            participants: { where: { userId: currentUserId } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        })
      : Promise.resolve([]),
    prisma.connection.findMany({
      where: {
        status: 'pending',
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
      },
    }),
  ])

  let unreadConversations = 0

  for (const thread of threads) {
    const me = thread.participants[0] ?? null
    const messages = thread.messages ?? []

    if (!isThreadVisible(me, messages)) {
      continue
    }

    const lastMessage = messages[0] ?? null

    if (isConversationUnread(me, lastMessage, currentUserId)) {
      unreadConversations += 1
    }
  }

  const pendingRequests = connections.filter(
    (connection) => connectionStateFor(currentUserId, connection) === 'incoming_pending',
  ).length

  return {
    unread_conversations: unreadConversations,
    pending_requests: pendingRequests,
    total: unreadConversations + pendingRequests,
  }
}
