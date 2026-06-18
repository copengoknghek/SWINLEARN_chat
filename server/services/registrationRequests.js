import { httpError } from '../http.js'
import {
  evaluateCourseEligibility,
  evaluateRegistrationBasket,
  loadPrerequisiteContext,
  prerequisiteFailureMessage,
} from './prerequisites.js'

const enrollmentOfferingId = (enrollment) => enrollment.offering_id ?? enrollment.offeringId

export const requestApprovalDeniedMessage = (eligibility) =>
  `You are not allowed to request approval for this course because prerequisite requirements are not met. ${prerequisiteFailureMessage(eligibility)}`

export async function submitRegistrationRequests(
  prismaClient,
  {
    studentId,
    offeringIds,
    context,
  },
) {
  const enrolledOfferingIds = new Set(
    context.enrollments
      .filter((enrollment) => enrollment.user_id === studentId || enrollment.userId === studentId)
      .map(enrollmentOfferingId),
  )
  const requestOfferingIds = offeringIds.filter((offeringId) => !enrolledOfferingIds.has(offeringId))
  const basketEligibility = evaluateRegistrationBasket({
    ...context,
    selectedOfferingIds: requestOfferingIds,
  })

  if (!basketEligibility.eligible) {
    const firstFailure = basketEligibility.results.find((result) => !result.eligible)

    throw httpError(400, requestApprovalDeniedMessage(firstFailure))
  }

  const requestedAt = new Date()
  const operations = requestOfferingIds.map((offeringId) =>
    prismaClient.courseRegistrationRequest.upsert({
      where: {
        offeringId_userId: {
          offeringId,
          userId: studentId,
        },
      },
      update: {
        status: 'pending',
        requestedAt,
        decidedAt: null,
        decidedById: null,
      },
      create: {
        offeringId,
        userId: studentId,
        status: 'pending',
        requestedAt,
      },
    }),
  )

  if (operations.length > 0) {
    await prismaClient.$transaction(operations)
  }

  return {
    requested_count: requestOfferingIds.length,
  }
}

export async function approveRegistrationRequest(
  prismaClient,
  {
    requestId,
    adminId,
    loadContext = loadPrerequisiteContext,
  },
) {
  const registrationRequest = await prismaClient.courseRegistrationRequest.findUnique({
    where: { id: requestId },
  })

  if (!registrationRequest) {
    throw httpError(404, 'Registration request was not found.')
  }

  const context = await loadContext(prismaClient, registrationRequest.userId)
  const targetOffering = context.offerings.find((offering) => offering.id === registrationRequest.offeringId)

  if (!context.student || context.student.role !== 'student') {
    throw httpError(400, 'Only student registration requests can be approved.')
  }

  if (!targetOffering) {
    throw httpError(404, 'Course offering was not found.')
  }

  const eligibility = evaluateCourseEligibility({
    ...context,
    targetOffering,
  })

  if (!eligibility.eligible) {
    throw httpError(400, prerequisiteFailureMessage(eligibility))
  }

  const decidedAt = new Date()

  await prismaClient.$transaction([
    prismaClient.enrollment.upsert({
      where: {
        offeringId_userId: {
          offeringId: registrationRequest.offeringId,
          userId: registrationRequest.userId,
        },
      },
      update: {},
      create: {
        offeringId: registrationRequest.offeringId,
        userId: registrationRequest.userId,
      },
    }),
    prismaClient.courseRegistrationRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        decidedAt,
        decidedById: adminId,
      },
    }),
  ])
}

export async function rejectRegistrationRequest(
  prismaClient,
  {
    requestId,
    adminId,
  },
) {
  await prismaClient.courseRegistrationRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      decidedAt: new Date(),
      decidedById: adminId,
    },
  })
}
