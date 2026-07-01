import { httpError } from '../http.js'

export function intervalsOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA)
}

export function roomIsFree({ room, startsAt, endsAt, consultations, sessions }) {
  const blockedByConsultation = consultations.some(
    (consultation) =>
      consultation.roomId === room.id &&
      intervalsOverlap(consultation.requestedStartsAt, consultation.requestedEndsAt, startsAt, endsAt),
  )

  if (blockedByConsultation) {
    return false
  }

  return !sessions.some(
    (session) =>
      session.location === room.name &&
      intervalsOverlap(session.startsAt, session.endsAt, startsAt, endsAt),
  )
}

export async function getAvailableRooms(
  prismaClient,
  {
    startsAt,
    endsAt,
    excludeRequestId,
  },
) {
  if (!startsAt || !endsAt) {
    throw httpError(400, 'Consultation start and end times are required.')
  }

  const start = new Date(startsAt)
  const end = new Date(endsAt)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw httpError(400, 'Consultation time range is invalid.')
  }

  const [rooms, consultations, sessions] = await Promise.all([
    prismaClient.room.findMany({ orderBy: { name: 'asc' } }),
    prismaClient.helpRequest.findMany({
      where: {
        status: 'approved',
        roomId: { not: null },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      select: {
        roomId: true,
        requestedStartsAt: true,
        requestedEndsAt: true,
      },
    }),
    prismaClient.courseSession.findMany({
      select: {
        location: true,
        startsAt: true,
        endsAt: true,
      },
    }),
  ])

  return rooms.filter((room) =>
    roomIsFree({
      room,
      startsAt: start,
      endsAt: end,
      consultations,
      sessions,
    }),
  )
}
