import { httpError } from '../http.js'
import { pairKey } from './inboxConnections.js'

const SHARE_EXCERPT_LENGTH = 160

export const shareNotEnrolledMessage =
  'This user is not enrolled in this course, so you cannot share this post with them.'

const excerpt = (body) => {
  const trimmed = String(body ?? '')
    .trim()
    .replace(/\s+/g, ' ')

  if (!trimmed) {
    return ''
  }

  if (trimmed.length <= SHARE_EXCERPT_LENGTH) {
    return trimmed
  }

  return `${trimmed.slice(0, SHARE_EXCERPT_LENGTH - 1)}…`
}

export async function loadOfferingMemberIds(prismaClient, offeringId) {
  const offering = await prismaClient.courseOffering.findUnique({
    where: { id: offeringId },
    include: { enrollments: true, staff: true },
  })

  if (!offering) {
    return null
  }

  return [
    ...new Set([
      ...offering.staff.map((member) => member.userId),
      ...offering.enrollments.map((member) => member.userId),
    ]),
  ]
}

export function buildCommunityShareMessage({ courseCode, post, sharePath }) {
  const preview = excerpt(post.body)
  const lines = [`Community post · ${courseCode}`]

  if (preview) {
    lines.push(`"${preview}"`)
  }

  lines.push(`Open: ${sharePath}`)

  return lines.join('\n')
}

export async function shareCommunityPostViaInbox(
  prismaClient,
  { courseCode, offeringId, post, recipientId, senderId, sharePath },
) {
  if (recipientId === senderId) {
    throw httpError(400, 'You cannot share a post with yourself.')
  }

  const recipient = await prismaClient.user.findUnique({ where: { id: recipientId } })

  if (!recipient) {
    throw httpError(404, 'User was not found.')
  }

  const memberIds = await loadOfferingMemberIds(prismaClient, offeringId)

  if (!memberIds) {
    throw httpError(404, 'Course offering was not found.')
  }

  if (!memberIds.includes(senderId)) {
    throw httpError(403, 'You are not enrolled in this course.')
  }

  if (!memberIds.includes(recipientId)) {
    throw httpError(403, shareNotEnrolledMessage)
  }

  const key = pairKey(senderId, recipientId)
  let thread = await prismaClient.inboxThread.findUnique({ where: { pairKey: key } })

  if (!thread) {
    thread = await prismaClient.inboxThread.create({
      data: {
        subject: '',
        pairKey: key,
        createdById: senderId,
        participants: {
          create: [
            { userId: senderId, lastReadAt: new Date() },
            { userId: recipientId },
          ],
        },
      },
    })
  }

  const body = buildCommunityShareMessage({ courseCode, post, sharePath })

  await prismaClient.$transaction([
    prismaClient.inboxMessage.create({
      data: {
        threadId: thread.id,
        senderId,
        body,
      },
    }),
    prismaClient.inboxThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    }),
    prismaClient.inboxThreadParticipant.update({
      where: {
        threadId_userId: {
          threadId: thread.id,
          userId: senderId,
        },
      },
      data: { lastReadAt: new Date() },
    }),
  ])

  return { conversation_id: thread.id, success: true }
}
