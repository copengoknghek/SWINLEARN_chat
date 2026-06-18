import express from 'express'
import multer from 'multer'

import { requireAuth, requireRole } from '../auth-middleware.js'
import { prisma } from '../db.js'
import { asyncHandler, requireBodyString, sendError } from '../http.js'
import {
  mapAssignment,
  mapChildMajor,
  mapCourseContentPackage,
  mapCourse,
  mapCurriculumRule,
  mapMainMajor,
  mapMessage,
  mapOffering,
  mapParticipant,
  mapSession,
  mapSubmission,
  mapThread,
  mapUserProfile,
} from '../mappers.js'
import { getCurriculumForChildMajor } from '../services/curriculum.js'
import {
  evaluateCourseEligibility,
  evaluateRegistrationBasket,
  loadPrerequisiteContext,
} from '../services/prerequisites.js'
import { requestApprovalDeniedMessage, submitRegistrationRequests } from '../services/registrationRequests.js'

export const workspaceRouter = express.Router()

const upload = multer({ dest: 'uploads/assignments' })

const offeringsInclude = {
  course: true,
  staff: true,
  enrollments: true,
}

workspaceRouter.get(
  '/catalog',
  asyncHandler(async (_request, response) => {
    const [mainMajors, childMajors] = await Promise.all([
      prisma.mainMajor.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.childMajor.findMany({ orderBy: [{ mainMajorId: 'asc' }, { sortOrder: 'asc' }] }),
    ])

    response.json({
      mainMajors: mainMajors.map(mapMainMajor),
      childMajors: childMajors.map(mapChildMajor),
    })
  }),
)

workspaceRouter.get(
  '/catalog/courses',
  asyncHandler(async (_request, response) => {
    const courses = await prisma.course.findMany({ orderBy: { code: 'asc' } })

    response.json(courses.map(mapCourse))
  }),
)

workspaceRouter.use((request, response, next) => {
  const user = requireAuth(request, response)

  if (!user) {
    return
  }

  next()
})

workspaceRouter.get(
  '/profiles',
  asyncHandler(async (_request, response) => {
    const profiles = await prisma.user.findMany({
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
    })

    response.json(profiles.map(mapUserProfile))
  }),
)

const visibleOfferingWhere = (user) => {
  if (user.role === 'admin') {
    return {}
  }

  if (user.role === 'teacher') {
    return {
      staff: {
        some: {
          userId: user.id,
        },
      },
    }
  }

  return {
    enrollments: {
      some: {
        userId: user.id,
      },
    },
  }
}

const visibleOfferingIds = async (user) => {
  const offerings = await prisma.courseOffering.findMany({
    where: visibleOfferingWhere(user),
    select: {
      id: true,
    },
  })

  return offerings.map((offering) => offering.id)
}

workspaceRouter.get(
  '/courses',
  asyncHandler(async (request, response) => {
    const offerings = await prisma.courseOffering.findMany({
      where: visibleOfferingWhere(request.currentUser),
      include: offeringsInclude,
      orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
    })

    response.json(offerings.map(mapOffering))
  }),
)

workspaceRouter.get(
  '/courses/:id/detail',
  asyncHandler(async (request, response) => {
    const offering = await prisma.courseOffering.findFirst({
      where: {
        id: request.params.id,
        ...visibleOfferingWhere(request.currentUser),
      },
      include: offeringsInclude,
    })

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const submissionWhere =
      request.currentUser.role === 'student'
        ? {
            assignment: {
              offeringId: offering.id,
            },
            studentId: request.currentUser.id,
          }
        : {
            assignment: {
              offeringId: offering.id,
            },
          }
    const [contentPackage, assignments, submissions] = await Promise.all([
      prisma.courseContentPackage.findFirst({
        where: {
          offeringId: offering.id,
          scope: 'offering',
        },
        include: {
          _count: {
            select: {
              assets: true,
              items: true,
              modules: true,
            },
          },
          assets: {
            orderBy: { title: 'asc' },
          },
          modules: {
            orderBy: { position: 'asc' },
            include: {
              items: {
                orderBy: { position: 'asc' },
                include: {
                  asset: true,
                },
              },
            },
          },
        },
      }),
      prisma.assignment.findMany({
        where: { offeringId: offering.id },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.assignmentSubmission.findMany({
        where: submissionWhere,
        orderBy: { submittedAt: 'desc' },
      }),
    ])
    const profileIds = [
      ...new Set([
        ...offering.staff.map((member) => member.userId),
        ...offering.enrollments.map((member) => member.userId),
        ...submissions.map((submission) => submission.studentId),
      ]),
    ]
    const profiles = profileIds.length
      ? await prisma.user.findMany({
          where: { id: { in: profileIds } },
          orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
        })
      : []

    response.json({
      assignments: assignments.map(mapAssignment),
      contentPackage: contentPackage ? mapCourseContentPackage(contentPackage) : null,
      course: mapOffering(offering),
      profiles: profiles.map(mapUserProfile),
      submissions: submissions.map(mapSubmission),
    })
  }),
)

const requireStudentRegistrationContext = async (request, response) => {
  const user = requireRole(request, response, ['student'])

  if (!user) {
    return null
  }

  return loadPrerequisiteContext(prisma, user.id)
}

const readOfferingIds = (body) =>
  Array.isArray(body.offering_ids)
    ? [...new Set(body.offering_ids.map((offeringId) => String(offeringId)).filter(Boolean))]
    : []

const activeRegistrationOfferings = (context) =>
  context.offerings.filter((offering) => offering.status === 'active')

const evaluateRegistrationSelection = (context, offeringIds) => {
  const activeOfferings = activeRegistrationOfferings(context)
  const activeOfferingIds = new Set(activeOfferings.map((offering) => offering.id))
  const invalidOfferingIds = offeringIds.filter((offeringId) => !activeOfferingIds.has(offeringId))

  if (offeringIds.length === 0) {
    return {
      error: 'Choose at least one active course offering.',
    }
  }

  if (invalidOfferingIds.length > 0) {
    return {
      error: 'One or more selected offerings are not available for registration.',
    }
  }

  return {
    result: evaluateRegistrationBasket({
      ...context,
      selectedOfferingIds: offeringIds,
      offerings: activeOfferings,
    }),
  }
}

workspaceRouter.get(
  '/registration',
  asyncHandler(async (request, response) => {
    const context = await requireStudentRegistrationContext(request, response)

    if (!context) {
      return
    }

    const offerings = activeRegistrationOfferings(context)
    const eligibility = offerings.map((targetOffering) =>
      evaluateCourseEligibility({
        ...context,
        targetOffering,
      }),
    )

    response.json({
      offerings,
      eligibility,
      registrationRequests: context.registrationRequests,
    })
  }),
)

workspaceRouter.post(
  '/registration/check',
  asyncHandler(async (request, response) => {
    const context = await requireStudentRegistrationContext(request, response)

    if (!context) {
      return
    }

    const evaluation = evaluateRegistrationSelection(context, readOfferingIds(request.body))

    if (evaluation.error) {
      sendError(response, 400, evaluation.error)
      return
    }

    response.json(evaluation.result)
  }),
)

workspaceRouter.post(
  '/registration',
  asyncHandler(async (request, response) => {
    const context = await requireStudentRegistrationContext(request, response)

    if (!context) {
      return
    }

    const offeringIds = readOfferingIds(request.body)
    const evaluation = evaluateRegistrationSelection(context, offeringIds)

    if (evaluation.error) {
      sendError(response, 400, evaluation.error)
      return
    }

    if (!evaluation.result.eligible) {
      const firstFailure = evaluation.result.results.find((result) => !result.eligible)

      sendError(response, 400, requestApprovalDeniedMessage(firstFailure))
      return
    }

    await submitRegistrationRequests(prisma, {
      studentId: request.currentUser.id,
      offeringIds,
      context,
    })

    response.status(201).json({ success: true })
  }),
)

workspaceRouter.get(
  '/curriculum',
  asyncHandler(async (request, response) => {
    if (!request.currentUser.childMajorId) {
      response.json({ required: [], electives: [] })
      return
    }

    const [childMajors, courses, rules] = await Promise.all([
      prisma.childMajor.findMany(),
      prisma.course.findMany(),
      prisma.curriculumRule.findMany(),
    ])
    const curriculum = getCurriculumForChildMajor({
      childMajorId: request.currentUser.childMajorId,
      childMajors: childMajors.map(mapChildMajor),
      courses: courses.map(mapCourse),
      rules: rules.map(mapCurriculumRule),
    })

    response.json(curriculum)
  }),
)

workspaceRouter.get(
  '/assignments',
  asyncHandler(async (request, response) => {
    const offeringIds = await visibleOfferingIds(request.currentUser)
    const assignments = await prisma.assignment.findMany({
      where: {
        offeringId: {
          in: offeringIds,
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    })

    response.json(assignments.map(mapAssignment))
  }),
)

workspaceRouter.post(
  '/assignments',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['admin', 'teacher'])

    if (!user) {
      return
    }

    const assignment = await prisma.assignment.create({
      data: {
        offeringId: requireBodyString(request.body, 'course_id'),
        title: requireBodyString(request.body, 'title'),
        description: String(request.body.description ?? '').trim(),
        dueAt: new Date(requireBodyString(request.body, 'due_at')),
        status: request.body.status === 'draft' || request.body.status === 'archived' ? request.body.status : 'published',
        createdById: user.id,
      },
    })

    response.status(201).json(mapAssignment(assignment))
  }),
)

workspaceRouter.patch(
  '/assignments/:id',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['admin', 'teacher'])

    if (!user) {
      return
    }

    const assignment = await prisma.assignment.update({
      where: { id: request.params.id },
      data: {
        title: request.body.title === undefined ? undefined : String(request.body.title).trim(),
        description:
          request.body.description === undefined ? undefined : String(request.body.description).trim(),
        dueAt: request.body.due_at === undefined ? undefined : new Date(String(request.body.due_at)),
        status:
          request.body.status === 'draft' || request.body.status === 'published' || request.body.status === 'archived'
            ? request.body.status
            : undefined,
      },
    })

    response.json(mapAssignment(assignment))
  }),
)

workspaceRouter.get(
  '/submissions',
  asyncHandler(async (request, response) => {
    const offeringIds = await visibleOfferingIds(request.currentUser)
    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        assignment: {
          offeringId: {
            in: offeringIds,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })

    response.json(submissions.map(mapSubmission))
  }),
)

workspaceRouter.post(
  '/assignments/:id/submission',
  upload.array('files'),
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const existing = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: request.params.id,
          studentId: user.id,
        },
      },
    })
    const existingPaths = Array.isArray(existing?.filePaths) ? existing.filePaths : []
    const filePaths = request.files.map((file) => file.path.replace(/\\/g, '/'))
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: request.params.id,
          studentId: user.id,
        },
      },
      update: {
        body: String(request.body.body ?? ''),
        filePaths: [...existingPaths, ...filePaths],
        submittedAt: new Date(),
      },
      create: {
        assignmentId: request.params.id,
        studentId: user.id,
        body: String(request.body.body ?? ''),
        filePaths,
      },
    })

    response.json(mapSubmission(submission))
  }),
)

workspaceRouter.get(
  '/sessions',
  asyncHandler(async (request, response) => {
    const offeringIds = await visibleOfferingIds(request.currentUser)
    const sessions = await prisma.courseSession.findMany({
      where: {
        offeringId: {
          in: offeringIds,
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    })

    response.json(sessions.map(mapSession))
  }),
)

workspaceRouter.get(
  '/inbox',
  asyncHandler(async (request, response) => {
    const ownParticipants = await prisma.inboxThreadParticipant.findMany({
      where: {
        userId: request.currentUser.id,
      },
    })
    const threadIds = ownParticipants.map((participant) => participant.threadId)
    const [profiles, threads, participants, messages] = await Promise.all([
      prisma.user.findMany({ orderBy: [{ displayName: 'asc' }, { email: 'asc' }] }),
      prisma.inboxThread.findMany({
        where: { id: { in: threadIds } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.inboxThreadParticipant.findMany({ where: { threadId: { in: threadIds } } }),
      prisma.inboxMessage.findMany({
        where: { threadId: { in: threadIds } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    response.json({
      profiles: profiles.map(mapUserProfile),
      threads: threads.map(mapThread),
      participants: participants.map(mapParticipant),
      messages: messages.map(mapMessage),
    })
  }),
)

workspaceRouter.post(
  '/inbox/threads',
  asyncHandler(async (request, response) => {
    const recipientId = requireBodyString(request.body, 'recipient_id')
    const subject = String(request.body.subject || 'Workspace message').trim()
    const body = requireBodyString(request.body, 'body')
    const thread = await prisma.inboxThread.create({
      data: {
        subject,
        createdById: request.currentUser.id,
        participants: {
          create: [
            {
              userId: request.currentUser.id,
              lastReadAt: new Date(),
            },
            {
              userId: recipientId,
            },
          ],
        },
        messages: {
          create: {
            senderId: request.currentUser.id,
            body,
          },
        },
      },
    })

    response.status(201).json({ id: thread.id })
  }),
)

workspaceRouter.post(
  '/inbox/threads/:id/messages',
  asyncHandler(async (request, response) => {
    const body = requireBodyString(request.body, 'body')
    const participant = await prisma.inboxThreadParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId: request.params.id,
          userId: request.currentUser.id,
        },
      },
    })

    if (!participant) {
      sendError(response, 403, 'You are not part of this thread.')
      return
    }

    await prisma.$transaction([
      prisma.inboxMessage.create({
        data: {
          threadId: request.params.id,
          senderId: request.currentUser.id,
          body,
        },
      }),
      prisma.inboxThread.update({
        where: { id: request.params.id },
        data: { updatedAt: new Date() },
      }),
      prisma.inboxThreadParticipant.update({
        where: {
          threadId_userId: {
            threadId: request.params.id,
            userId: request.currentUser.id,
          },
        },
        data: {
          lastReadAt: new Date(),
        },
      }),
    ])

    response.json({ success: true })
  }),
)

workspaceRouter.patch(
  '/inbox/threads/:id/read',
  asyncHandler(async (request, response) => {
    await prisma.inboxThreadParticipant.update({
      where: {
        threadId_userId: {
          threadId: request.params.id,
          userId: request.currentUser.id,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    })

    response.json({ success: true })
  }),
)
