import { httpError } from '../http.js'
import { getAvailableRooms } from './roomAvailability.js'

export const CONSULTATION_TOPIC = 'book-consultation'
export const CONSULTATION_DURATION_MS = 30 * 60 * 1000
const BUSINESS_HOUR_START = 8
const BUSINESS_HOUR_END = 18

export function resolveHelpRequestType(topic) {
  return topic === CONSULTATION_TOPIC ? 'consultation' : 'general'
}

export function parseConsultationDateTime(dateString, timeString) {
  const [year, month, day] = String(dateString).split('-').map(Number)
  const [hours, minutes] = String(timeString).split(':').map(Number)

  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw httpError(400, 'Consultation date and time are required.')
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

export function buildConsultationEndsAt(startsAt) {
  return new Date(new Date(startsAt).getTime() + CONSULTATION_DURATION_MS)
}

export function assertConsultationSlot(startsAt, endsAt, now = new Date()) {
  if (startsAt.getTime() < now.getTime()) {
    throw httpError(400, 'Consultation cannot be scheduled in the past.')
  }

  const hour = startsAt.getHours()

  if (hour < BUSINESS_HOUR_START || hour >= BUSINESS_HOUR_END) {
    throw httpError(400, 'Consultations must be scheduled between 08:00 and 18:00.')
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw httpError(400, 'Consultation end time must be after the start time.')
  }
}

export function sortTeachersRecommendedFirst(teachers, recommendedIds) {
  const recommended = new Set(recommendedIds)

  return [...teachers].sort((left, right) => {
    const leftRank = recommended.has(left.id) ? 0 : 1
    const rightRank = recommended.has(right.id) ? 0 : 1

    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }

    const leftName = left.fullName || left.displayName || left.email || ''
    const rightName = right.fullName || right.displayName || right.email || ''

    return leftName.localeCompare(rightName)
  })
}

const normalizeTopic = (topic) => String(topic ?? '').trim()

const normalizeDetails = (details) => String(details ?? '').trim()

export async function listTeachersForConsultation(prismaClient, studentId) {
  const [teachers, enrollments] = await Promise.all([
    prismaClient.user.findMany({
      where: { role: 'teacher', status: 'active' },
      orderBy: { fullName: 'asc' },
    }),
    prismaClient.enrollment.findMany({
      where: { userId: studentId },
      select: { offeringId: true },
    }),
  ])

  const offeringIds = enrollments.map((enrollment) => enrollment.offeringId)
  const staff =
    offeringIds.length > 0
      ? await prismaClient.courseStaff.findMany({
          where: { offeringId: { in: offeringIds } },
          select: { userId: true },
        })
      : []

  const recommendedIds = [...new Set(staff.map((member) => member.userId))]
  const sorted = sortTeachersRecommendedFirst(teachers, recommendedIds)

  return sorted.map((teacher) => ({
    ...teacher,
    recommended: recommendedIds.includes(teacher.id),
  }))
}

export async function submitHelpRequest(
  prismaClient,
  {
    requester,
    topic,
    details,
    teacherId,
    consultationDate,
    consultationTime,
    offeringId,
  },
) {
  const normalizedTopic = normalizeTopic(topic)

  if (!normalizedTopic) {
    throw httpError(400, 'Topic is required.')
  }

  const type = resolveHelpRequestType(normalizedTopic)

  if (type === 'consultation' && requester.role !== 'student') {
    throw httpError(400, 'Only students can book consultations.')
  }

  let requestedStartsAt = null
  let requestedEndsAt = null
  let resolvedTeacherId = null

  if (type === 'consultation') {
    if (!teacherId) {
      throw httpError(400, 'Teacher is required for consultations.')
    }

    const teacher = await prismaClient.user.findFirst({
      where: { id: teacherId, role: 'teacher', status: 'active' },
    })

    if (!teacher) {
      throw httpError(400, 'Selected teacher was not found.')
    }

    requestedStartsAt = parseConsultationDateTime(consultationDate, consultationTime)
    requestedEndsAt = buildConsultationEndsAt(requestedStartsAt)
    assertConsultationSlot(requestedStartsAt, requestedEndsAt)
    resolvedTeacherId = teacher.id
  }

  return prismaClient.helpRequest.create({
    data: {
      requesterId: requester.id,
      type,
      topic: normalizedTopic,
      details: normalizeDetails(details),
      teacherId: resolvedTeacherId,
      offeringId: offeringId || null,
      requestedStartsAt,
      requestedEndsAt,
      status: 'submitted',
    },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function listHelpRequestsForUser(prismaClient, userId) {
  return prismaClient.helpRequest.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function listHelpRequestsForTeacher(prismaClient, teacherId) {
  return prismaClient.helpRequest.findMany({
    where: {
      teacherId,
      type: 'consultation',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function listAllHelpRequests(prismaClient) {
  return prismaClient.helpRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

const loadHelpRequest = (prismaClient, requestId) =>
  prismaClient.helpRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })

export async function forwardToTeacher(prismaClient, { requestId }) {
  const helpRequest = await loadHelpRequest(prismaClient, requestId)

  if (!helpRequest) {
    throw httpError(404, 'Help request was not found.')
  }

  if (helpRequest.type !== 'consultation') {
    throw httpError(400, 'Only consultation requests can be forwarded to a teacher.')
  }

  if (helpRequest.status !== 'submitted') {
    throw httpError(400, 'This request cannot be forwarded in its current state.')
  }

  if (!helpRequest.teacherId) {
    throw httpError(400, 'Consultation request is missing a teacher.')
  }

  return prismaClient.helpRequest.update({
    where: { id: requestId },
    data: { status: 'awaiting_teacher' },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function respondAsTeacher(
  prismaClient,
  {
    requestId,
    teacherId,
    accepted,
  },
) {
  const helpRequest = await loadHelpRequest(prismaClient, requestId)

  if (!helpRequest) {
    throw httpError(404, 'Help request was not found.')
  }

  if (helpRequest.teacherId !== teacherId) {
    throw httpError(403, 'You are not assigned to this consultation request.')
  }

  if (helpRequest.status !== 'awaiting_teacher') {
    throw httpError(400, 'This request is not waiting for teacher response.')
  }

  return prismaClient.helpRequest.update({
    where: { id: requestId },
    data: {
      status: accepted ? 'awaiting_room' : 'teacher_declined',
      teacherRespondedAt: new Date(),
    },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function approveGeneralRequest(
  prismaClient,
  {
    requestId,
    adminId,
  },
) {
  const helpRequest = await loadHelpRequest(prismaClient, requestId)

  if (!helpRequest) {
    throw httpError(404, 'Help request was not found.')
  }

  if (helpRequest.type !== 'general') {
    throw httpError(400, 'Only general help requests can be approved directly.')
  }

  if (helpRequest.status !== 'submitted') {
    throw httpError(400, 'This request cannot be approved in its current state.')
  }

  return prismaClient.helpRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      decidedById: adminId,
      decidedAt: new Date(),
    },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function approveConsultation(
  prismaClient,
  {
    requestId,
    adminId,
    roomId,
  },
) {
  const helpRequest = await loadHelpRequest(prismaClient, requestId)

  if (!helpRequest) {
    throw httpError(404, 'Help request was not found.')
  }

  if (helpRequest.type !== 'consultation') {
    throw httpError(400, 'Only consultation requests need a room assignment.')
  }

  if (helpRequest.status !== 'awaiting_room') {
    throw httpError(400, 'This consultation is not ready for room assignment.')
  }

  if (!roomId) {
    throw httpError(400, 'Room is required to confirm a consultation.')
  }

  const room = await prismaClient.room.findUnique({ where: { id: roomId } })

  if (!room) {
    throw httpError(400, 'Selected room was not found.')
  }

  const availableRooms = await getAvailableRooms(prismaClient, {
    startsAt: helpRequest.requestedStartsAt,
    endsAt: helpRequest.requestedEndsAt,
    excludeRequestId: requestId,
  })

  if (!availableRooms.some((candidate) => candidate.id === roomId)) {
    throw httpError(400, 'Selected room is not available for this time slot.')
  }

  return prismaClient.helpRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      roomId,
      decidedById: adminId,
      decidedAt: new Date(),
    },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}

export async function rejectRequest(
  prismaClient,
  {
    requestId,
    adminId,
  },
) {
  const helpRequest = await loadHelpRequest(prismaClient, requestId)

  if (!helpRequest) {
    throw httpError(404, 'Help request was not found.')
  }

  if (helpRequest.status === 'approved' || helpRequest.status === 'rejected') {
    throw httpError(400, 'This request has already been finalized.')
  }

  return prismaClient.helpRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      decidedById: adminId,
      decidedAt: new Date(),
    },
    include: {
      requester: true,
      teacher: true,
      room: true,
      offering: { include: { course: true } },
    },
  })
}
