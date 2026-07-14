import express from 'express'
import { rm } from 'node:fs/promises'
import multer from 'multer'

import { requireAuth, requireRole } from '../auth-middleware.js'
import { prisma } from '../db.js'
import { asyncHandler, requireBodyString, sendError } from '../http.js'
import {
  mapAssignment,
  mapChildMajor,
  mapConnection,
  mapConversation,
  isThreadVisible,
  mapCommunityPost,
  mapCommunityComment,
  mapCourseContentPackage,
  mapCourse,
  mapCurriculumRule,
  mapCvEducation,
  mapCvProfile,
  mapHelpRequest,
  mapConsultationTeacher,
  mapMainMajor,
  mapOffering,
  mapSession,
  mapSubmission,
  mapSwinlearnAttachment,
  mapSwinlearnKnowledgeIndex,
  mapSwinlearnMessage,
  mapSwinlearnThread,
  mapUserProfile,
} from '../mappers.js'
import {
  assertCanAddGroupMember,
  assertCanCreateGroup,
  assertCanOpenConversation,
  assertCanRequestConnection,
  assertValidInboxColor,
  buildPersonSearchWhere,
  connectionStateFor,
  orderPair,
} from '../services/inboxConnections.js'
import { getCurriculumForChildMajor } from '../services/curriculum.js'
import {
  evaluateCourseEligibility,
  evaluateRegistrationBasket,
  loadPrerequisiteContext,
} from '../services/prerequisites.js'
import { requestApprovalDeniedMessage, submitRegistrationRequests } from '../services/registrationRequests.js'
import { buildGradeReport, buildGradeReportWorkbook, buildGradeReportPdf, formatGradeReportMarkdown, gradeReportPdfFilename, gradeReportWorkbookFilename } from '../services/gradeReport.js'
import { detectGradeAnalysisThreadContext, detectLanguage } from '../services/gradeAnalysis.js'
import { routeIntent } from '../services/intentRouter.js'
import {
  buildExplicitRoute,
  handleSwinlearnMessage,
  UI_INTENTS,
} from '../services/swinlearnMessageHandler.js'
import { buildStudentProgress } from '../services/studentProgress.js'
import {
  assertCommunityCommentContent,
  assertCommunityPostContent,
  canDeleteCommunityComment,
  canDeleteCommunityPost,
  collectCommunityCommentSubtreeIds,
} from '../services/community.js'
import { countCommunityUnreadByOffering, markCommunityRead } from '../services/communityUnread.js'
import { searchGiphy } from '../services/giphy.js'
import {
  awardCommentLikeGold,
  awardCommentReceivedGold,
  awardPostLikeGold,
  awardShareReceivedGold,
  loadGamificationContext,
  mapProfileGamification,
  recomputeBadges,
  reverseCommentLikeGold,
  reverseCommentSubtreeGold,
  reversePostEngagementGold,
  reversePostLikeGold,
} from '../services/gamification.js'
import {
  communityUpload,
  communityMaxImagesPerComment,
  createCommunityCommentImages,
  createCommunityPostImages,
} from '../services/communityFiles.js'
import { shareCommunityPostViaInbox } from '../services/communityShare.js'
import {
  acceptConnectionWithWelcomeMessage,
  assertInboxMessageContent,
  countInboxBadge,
  ensureDirectConversation,
} from '../services/inboxMessages.js'
import {
  listHelpRequestsForTeacher,
  listHelpRequestsForUser,
  listTeachersForConsultation,
  respondAsTeacher,
  submitHelpRequest,
} from '../services/helpRequests.js'
import {
  readSwinlearnUploadText,
  validateSwinlearnUpload,
  swinlearnUpload,
} from '../services/swinlearnFiles.js'
import {
  createSwinlearnRagServices,
  ensureIndexedOfferings,
  indexThreadUpload,
} from '../services/swinlearnIndexing.js'
import {
  ensureSwinlearnKnowledgeIndex,
  buildKnowledgeIndexView,
  indexStatusForPackage,
  loadOfferingKnowledge,
  loadSwinlearnContext,
  markSwinlearnIndexesStaleForOffering,
  normalizeSelectedOfferingIds,
  resolveIndexOfferingIds,
} from '../services/swinlearnKnowledge.js'
import { createSwinlearnGroqClient } from '../services/swinlearnGroq.js'
import { resolveMessageCourseScope } from '../services/swinlearnCourseScope.js'
import { parseGithubRepoUrl } from '../services/githubProjectSnapshot.js'
import { detectCvThreadContext, loadSubmittedProjectsForStudent } from '../services/cvProjectScope.js'
import { indexAssignmentSubmission } from '../services/submissionIndexing.js'
import {
  profileAvatarUpload,
  removeStoredAvatar,
  validateProfileAvatar,
} from '../services/profileAvatar.js'

export const workspaceRouter = express.Router()

const swinlearnRag = createSwinlearnRagServices()

const upload = multer({ dest: 'uploads/assignments' })

const offeringsInclude = {
  course: true,
  staff: true,
  enrollments: true,
  swinlearnKnowledgeIndex: true,
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

workspaceRouter.post(
  '/profile/avatar',
  profileAvatarUpload.single('avatar'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      sendError(response, 400, 'Choose an image to upload.')
      return
    }

    const validated = validateProfileAvatar(request.file)
    const currentUser = await prisma.user.findUnique({
      where: { id: request.currentUser.id },
      select: { avatarUrl: true },
    })

    if (currentUser?.avatarUrl) {
      await removeStoredAvatar(currentUser.avatarUrl)
    }

    const user = await prisma.user.update({
      where: { id: request.currentUser.id },
      data: { avatarUrl: validated.publicUrl },
    })

    response.json(mapUserProfile(user))
  }),
)

const loadStudentCvProfileContext = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      childMajor: true,
      cvProfile: true,
    },
  })

  return user
}

workspaceRouter.get(
  '/cv-profile',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const student = await loadStudentCvProfileContext(user.id)

    response.json({
      cv_profile: mapCvProfile(student?.cvProfile),
      education: mapCvEducation(student),
    })
  }),
)

workspaceRouter.patch(
  '/cv-profile',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const phone =
      request.body.phone === undefined ? undefined : String(request.body.phone ?? '').trim() || null
    const headlineRole =
      request.body.headline_role === undefined
        ? undefined
        : String(request.body.headline_role ?? '').trim() || null
    const certifications =
      request.body.certifications === undefined
        ? undefined
        : String(request.body.certifications ?? '').trim() || null

    if (phone === undefined && headlineRole === undefined && certifications === undefined) {
      sendError(response, 400, 'Provide phone, headline_role, and/or certifications to update.')
      return
    }

    const data = {}

    if (phone !== undefined) {
      data.phone = phone
    }

    if (headlineRole !== undefined) {
      data.headlineRole = headlineRole
    }

    if (certifications !== undefined) {
      data.certifications = certifications
    }

    const profile = await prisma.userCvProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...data,
      },
      update: data,
    })

    const student = await loadStudentCvProfileContext(user.id)

    response.json({
      cv_profile: mapCvProfile(profile),
      education: mapCvEducation(student),
    })
  }),
)

workspaceRouter.delete(
  '/profile/avatar',
  asyncHandler(async (request, response) => {
    const currentUser = await prisma.user.findUnique({
      where: { id: request.currentUser.id },
      select: { avatarUrl: true },
    })

    if (currentUser?.avatarUrl) {
      await removeStoredAvatar(currentUser.avatarUrl)
    }

    const user = await prisma.user.update({
      where: { id: request.currentUser.id },
      data: { avatarUrl: null },
    })

    response.json(mapUserProfile(user))
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

const loadVisibleOffering = (user, offeringId) =>
  prisma.courseOffering.findFirst({
    where: {
      id: offeringId,
      ...visibleOfferingWhere(user),
    },
    include: {
      staff: true,
    },
  })

const communityCommentInclude = (currentUserId) => ({
  author: true,
  images: {
    orderBy: { sortOrder: 'asc' },
  },
  likes: {
    where: { userId: currentUserId },
    select: { userId: true },
  },
  _count: {
    select: {
      likes: true,
      replies: true,
    },
  },
})

const communityPostInclude = (currentUserId) => ({
  author: true,
  images: {
    orderBy: { sortOrder: 'asc' },
  },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: communityCommentInclude(currentUserId),
  },
  likes: {
    where: { userId: currentUserId },
    select: { userId: true },
  },
  _count: {
    select: {
      comments: true,
      likes: true,
    },
  },
})

const collectCommunityAuthorIds = (posts, currentUserId) => {
  const ids = new Set([currentUserId])

  for (const post of posts) {
    if (post.authorId) {
      ids.add(post.authorId)
    }

    for (const comment of post.comments ?? []) {
      if (comment.authorId) {
        ids.add(comment.authorId)
      }
    }
  }

  return [...ids]
}

const mapCommunityContext = (request, offering, gamificationContext) => ({
  currentUserId: request.currentUser.id,
  offering,
  user: request.currentUser,
  gamificationContext,
})

workspaceRouter.get(
  '/courses',
  asyncHandler(async (request, response) => {
    const offerings = await prisma.courseOffering.findMany({
      where: visibleOfferingWhere(request.currentUser),
      include: offeringsInclude,
      orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
    })

    if (request.currentUser.role === 'student') {
      const offeringIds = offerings.map((offering) => offering.id)
      const unreadByOffering = await countCommunityUnreadByOffering(
        prisma,
        request.currentUser.id,
        offeringIds,
      )

      response.json(
        offerings.map((offering) => ({
          ...mapOffering(offering),
          community_unread_count: unreadByOffering[offering.id]?.total ?? 0,
        })),
      )
      return
    }

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
      knowledge_index: buildKnowledgeIndexView(offering.swinlearnKnowledgeIndex, contentPackage?.id ?? null, {
        requireVectors: swinlearnRag.configured,
      }),
      profiles: profiles.map(mapUserProfile),
      submissions: submissions.map(mapSubmission),
    })
  }),
)

workspaceRouter.post(
  '/courses/:id/community/read',
  asyncHandler(async (request, response) => {
    if (request.currentUser.role !== 'student') {
      sendError(response, 403, 'Only students can mark community as read.')
      return
    }

    const offering = await loadVisibleOffering(request.currentUser, request.params.id)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    await markCommunityRead(prisma, request.currentUser.id, offering.id)
    response.json({ ok: true })
  }),
)

workspaceRouter.get(
  '/courses/:id/community',
  asyncHandler(async (request, response) => {
    const offering = await loadVisibleOffering(request.currentUser, request.params.id)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const posts = await prisma.communityPost.findMany({
      where: { offeringId: offering.id },
      orderBy: { createdAt: 'desc' },
      include: communityPostInclude(request.currentUser.id),
    })

    const gamificationContext = await loadGamificationContext(
      prisma,
      collectCommunityAuthorIds(posts, request.currentUser.id),
    )
    const communityContext = mapCommunityContext(request, offering, gamificationContext)

    if (request.currentUser.role === 'student') {
      await markCommunityRead(prisma, request.currentUser.id, offering.id)
    }

    response.json({
      posts: posts.map((post) => mapCommunityPost(post, communityContext)),
      viewer: mapProfileGamification(request.currentUser, gamificationContext),
    })
  }),
)

workspaceRouter.get(
  '/community/giphy',
  asyncHandler(async (request, response) => {
    const result = await searchGiphy({
      query: request.query.q,
      offset: request.query.offset,
      limit: request.query.limit,
      apiKey: process.env.GIPHY_API_KEY,
    })

    response.json(result)
  }),
)

workspaceRouter.post(
  '/courses/:id/community/posts',
  communityUpload.array('images', 4),
  asyncHandler(async (request, response) => {
    const offering = await loadVisibleOffering(request.currentUser, request.params.id)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const files = request.files ?? []
    const body = assertCommunityPostContent(request.body.body, files.length)
    const post = await prisma.communityPost.create({
      data: {
        offeringId: offering.id,
        authorId: request.currentUser.id,
        body,
      },
    })

    if (files.length > 0) {
      await createCommunityPostImages(prisma, post.id, files)
    }

    const created = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: communityPostInclude(request.currentUser.id),
    })

    response.status(201).json(
      mapCommunityPost(created, {
        currentUserId: request.currentUser.id,
        offering,
        user: request.currentUser,
      }),
    )
  }),
)

workspaceRouter.delete(
  '/community/posts/:postId',
  asyncHandler(async (request, response) => {
    const post = await prisma.communityPost.findUnique({
      where: { id: request.params.postId },
      include: {
        images: true,
        offering: {
          include: { staff: true },
        },
      },
    })

    if (!post) {
      sendError(response, 404, 'Post was not found.')
      return
    }

    const offering = await loadVisibleOffering(request.currentUser, post.offeringId)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    if (!canDeleteCommunityPost(request.currentUser, offering, post)) {
      sendError(response, 403, 'You cannot delete this post.')
      return
    }

    await Promise.all(
      post.images.map((image) => rm(image.storedPath, { force: true }).catch(() => undefined)),
    )

    await prisma.$transaction(async (tx) => {
      await reversePostEngagementGold(tx, post.id)
      await tx.communityPost.delete({ where: { id: post.id } })
    })
    await recomputeBadges(prisma)

    response.json({ success: true })
  }),
)

workspaceRouter.post(
  '/courses/:id/community/posts/:postId/comments',
  communityUpload.array('images', communityMaxImagesPerComment),
  asyncHandler(async (request, response) => {
    const offering = await loadVisibleOffering(request.currentUser, request.params.id)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const post = await prisma.communityPost.findFirst({
      where: {
        id: request.params.postId,
        offeringId: offering.id,
      },
    })

    if (!post) {
      sendError(response, 404, 'Post was not found.')
      return
    }

    const parentId = String(request.body.parent_id ?? '').trim() || null
    let parentComment = null

    if (parentId) {
      parentComment = await prisma.communityComment.findFirst({
        where: {
          id: parentId,
          postId: post.id,
        },
      })

      if (!parentComment) {
        sendError(response, 404, 'Parent comment was not found.')
        return
      }
    }

    const files = request.files ?? []
    const { body, gifUrl } = assertCommunityCommentContent({
      body: request.body.body,
      gifUrl: request.body.gif_url,
      imageCount: files.length,
    })

    const recipientId = parentComment ? parentComment.authorId : post.authorId

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.communityComment.create({
        data: {
          authorId: request.currentUser.id,
          body,
          gifUrl,
          parentId,
          postId: post.id,
        },
      })

      await awardCommentReceivedGold(tx, {
        recipientId,
        commenterId: request.currentUser.id,
        commentId: created.id,
      })

      return created
    })

    if (files.length > 0) {
      await createCommunityCommentImages(prisma, comment.id, files)
    }

    await recomputeBadges(prisma)

    const created = await prisma.communityComment.findUnique({
      where: { id: comment.id },
      include: communityCommentInclude(request.currentUser.id),
    })

    response.status(201).json(
      mapCommunityComment(created, {
        currentUserId: request.currentUser.id,
        offering,
        user: request.currentUser,
      }),
    )
  }),
)

workspaceRouter.delete(
  '/community/comments/:commentId',
  asyncHandler(async (request, response) => {
    const comment = await prisma.communityComment.findUnique({
      where: { id: request.params.commentId },
      include: {
        post: {
          include: {
            offering: {
              include: { staff: true },
            },
          },
        },
      },
    })

    if (!comment) {
      sendError(response, 404, 'Comment was not found.')
      return
    }

    const offering = await loadVisibleOffering(
      request.currentUser,
      comment.post.offeringId,
    )

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    if (!canDeleteCommunityComment(request.currentUser, offering, comment)) {
      sendError(response, 403, 'You cannot delete this comment.')
      return
    }

    const subtreeIds = await collectCommunityCommentSubtreeIds(prisma, comment.id)
    const images = await prisma.communityCommentImage.findMany({
      where: { commentId: { in: subtreeIds } },
    })

    await Promise.all(
      images.map((image) => rm(image.storedPath, { force: true }).catch(() => undefined)),
    )

    await prisma.$transaction(async (tx) => {
      await reverseCommentSubtreeGold(tx, comment.id)
      await tx.communityComment.delete({ where: { id: comment.id } })
    })
    await recomputeBadges(prisma)

    response.json({ success: true })
  }),
)

workspaceRouter.post(
  '/courses/:id/community/comments/:commentId/like',
  asyncHandler(async (request, response) => {
    const offering = await loadVisibleOffering(request.currentUser, request.params.id)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const comment = await prisma.communityComment.findFirst({
      where: {
        id: request.params.commentId,
        post: {
          offeringId: offering.id,
        },
      },
      include: {
        author: { select: { id: true, role: true } },
      },
    })

    if (!comment) {
      sendError(response, 404, 'Comment was not found.')
      return
    }

    const existing = await prisma.communityCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId: comment.id,
          userId: request.currentUser.id,
        },
      },
    })

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.communityCommentLike.delete({ where: { id: existing.id } })
        await reverseCommentLikeGold(tx, { likeId: existing.id })
        return
      }

      const like = await tx.communityCommentLike.create({
        data: {
          commentId: comment.id,
          userId: request.currentUser.id,
        },
      })

      await awardCommentLikeGold(tx, {
        commentAuthorId: comment.authorId,
        likerId: request.currentUser.id,
        likeId: like.id,
      })
    })

    await recomputeBadges(prisma)

    const likeCount = await prisma.communityCommentLike.count({
      where: { commentId: comment.id },
    })

    response.json({
      liked: !existing,
      like_count: likeCount,
    })
  }),
)

workspaceRouter.post(
  '/courses/:id/community/posts/:postId/like',
  asyncHandler(async (request, response) => {
    const offering = await loadVisibleOffering(request.currentUser, request.params.id)

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const post = await prisma.communityPost.findFirst({
      where: {
        id: request.params.postId,
        offeringId: offering.id,
      },
      select: { id: true, authorId: true },
    })

    if (!post) {
      sendError(response, 404, 'Post was not found.')
      return
    }

    const existing = await prisma.communityPostLike.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: request.currentUser.id,
        },
      },
    })

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.communityPostLike.delete({ where: { id: existing.id } })
        await reversePostLikeGold(tx, { likeId: existing.id })
        return
      }

      const like = await tx.communityPostLike.create({
        data: {
          postId: post.id,
          userId: request.currentUser.id,
        },
      })

      await awardPostLikeGold(tx, {
        postAuthorId: post.authorId,
        likerId: request.currentUser.id,
        likeId: like.id,
      })
    })

    await recomputeBadges(prisma)

    const likeCount = await prisma.communityPostLike.count({
      where: { postId: post.id },
    })
    const liked = !existing

    response.json({
      liked,
      like_count: likeCount,
    })
  }),
)

workspaceRouter.post(
  '/courses/:id/community/posts/:postId/share',
  asyncHandler(async (request, response) => {
    const offering = await prisma.courseOffering.findFirst({
      where: {
        id: request.params.id,
        ...visibleOfferingWhere(request.currentUser),
      },
      include: { course: true },
    })

    if (!offering) {
      sendError(response, 404, 'Course offering was not found.')
      return
    }

    const post = await prisma.communityPost.findFirst({
      where: {
        id: request.params.postId,
        offeringId: offering.id,
      },
    })

    if (!post) {
      sendError(response, 404, 'Post was not found.')
      return
    }

    const recipientId = requireBodyString(request.body, 'recipient_id')
    const sharePath = requireBodyString(request.body, 'share_path')

    const result = await shareCommunityPostViaInbox(prisma, {
      courseCode: offering.course.code,
      offeringId: offering.id,
      post,
      recipientId,
      senderId: request.currentUser.id,
      sharePath,
    })

    let shareEvent = null

    try {
      shareEvent = await prisma.shareEvent.create({
        data: {
          postId: post.id,
          sharedById: request.currentUser.id,
          recipientId,
        },
      })
    } catch (error) {
      if (error?.code !== 'P2002') {
        throw error
      }
    }

    if (shareEvent) {
      await prisma.$transaction(async (tx) => {
        await awardShareReceivedGold(tx, {
          postAuthorId: post.authorId,
          sharerId: request.currentUser.id,
          shareEventId: shareEvent.id,
        })
      })
      await recomputeBadges(prisma)
    }

    response.status(201).json(result)
  }),
)

const readJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

const readSelectedOfferingIds = (body, enrolledOfferingIds) =>
  normalizeSelectedOfferingIds(
    readJsonArray(body.selected_offering_ids ?? body.offering_ids),
    enrolledOfferingIds,
  )

const readAssignmentIds = (body) =>
  readJsonArray(body.assignment_ids)
    .map((id) => String(id).trim())
    .filter(Boolean)

const mapSwinlearnCourseContext = (offering) => {
  const contentPackage = offering.contentPackages?.[0] ?? null
  const currentPackageId = contentPackage?.id ?? null
  const index = offering.swinlearnKnowledgeIndex

  return {
    ...mapOffering(offering),
    content_package: contentPackage ? mapCourseContentPackage(contentPackage) : null,
    knowledge_index: {
      ...(mapSwinlearnKnowledgeIndex(index) ?? {}),
      status: indexStatusForPackage(index, currentPackageId, {
        requireVectors: swinlearnRag.configured,
      }),
    },
  }
}

const loadSwinlearnThread = async (studentId, threadId, include = {}) =>
  prisma.swinlearnThread.findFirst({
    where: {
      id: threadId,
      studentId,
    },
    include,
  })

const loadThreadMessages = (threadId) =>
  prisma.swinlearnMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
  })

const createSwinlearnAttachments = async ({
  files,
  groq,
  messageId,
  rag,
  thread,
  userId,
}) => {
  const attachments = []
  const documents = []
  const imageInputs = []

  for (const file of files) {
    try {
      const validation = validateSwinlearnUpload(file)
      const text = rag?.configured ? '' : await readSwinlearnUploadText(file, validation)

      if (text) {
        documents.push({
          id: `upload:${file.originalname}`,
          source: 'upload',
          text,
          title: file.originalname,
        })
      }

      if (validation.kind === 'image' && groq.configured) {
        imageInputs.push(await groq.imageInputFromFile({
          filePath: file.path,
          mimeType: file.mimetype,
        }))
      }

      const attachment = await prisma.swinlearnAttachment.create({
        data: {
          fileKind: validation.kind,
          messageId,
          mimeType: file.mimetype || null,
          openaiFileId: null,
          originalName: file.originalname,
          size: file.size,
          storedPath: file.path.replace(/\\/g, '/'),
          supportedByFileSearch: validation.supportedByFileSearch,
          threadId: thread.id,
          vectorStoreId: null,
        },
      })

      if (rag?.configured && validation.supportedByFileSearch) {
        await indexThreadUpload({
          attachment,
          embedder: rag.embedder,
          file,
          messageId,
          prisma,
          threadId: thread.id,
          userId,
          validation,
          vectorStore: rag.vectorStore,
        })
      }

      attachments.push(attachment)
    } catch (error) {
      await rm(file.path, { force: true }).catch(() => undefined)
      throw error
    }
  }

  return { attachments, documents, imageInputs }
}

workspaceRouter.get(
  '/swinlearn/submitted-projects',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const offerings = await loadSwinlearnContext(prisma, user.id)
    const offeringIds = offerings.map((offering) => offering.id)
    const courses = await loadSubmittedProjectsForStudent({
      offeringIds,
      prisma,
      studentId: user.id,
    })

    response.json({ courses })
  }),
)

workspaceRouter.get(
  '/swinlearn/context',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const offerings = await loadSwinlearnContext(prisma, user.id)

    response.json({
      courses: offerings.map(mapSwinlearnCourseContext),
    })
  }),
)

workspaceRouter.post(
  '/swinlearn/index',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['admin', 'teacher'])

    if (!user) {
      return
    }

    const selectedOfferingIds = await resolveIndexOfferingIds(
      prisma,
      readJsonArray(request.body.selected_offering_ids ?? request.body.offering_ids),
    )

    if (selectedOfferingIds.length === 0) {
      sendError(response, 400, 'Select at least one valid course offering to index.')
      return
    }

    const rag = createSwinlearnRagServices()
    const indexes = []

    if (rag.configured) {
      indexes.push(
        ...(await ensureIndexedOfferings({
          embedder: rag.embedder,
          force: true,
          offeringIds: selectedOfferingIds,
          prisma,
          vectorStore: rag.vectorStore,
        })),
      )
    } else {
      for (const offeringId of selectedOfferingIds) {
        const index = await ensureSwinlearnKnowledgeIndex({
          force: true,
          offeringId,
          prisma,
        })

        if (index) {
          indexes.push(index)
        }
      }
    }

    response.json({
      indexes: indexes.map(mapSwinlearnKnowledgeIndex),
    })
  }),
)

workspaceRouter.get(
  '/swinlearn/threads',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const threads = await prisma.swinlearnThread.findMany({
      where: { studentId: user.id },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
    })

    response.json(threads.map(mapSwinlearnThread))
  }),
)

workspaceRouter.post(
  '/swinlearn/threads',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const offerings = await loadSwinlearnContext(prisma, user.id)
    const selectedOfferingIds = readSelectedOfferingIds(
      request.body,
      offerings.map((offering) => offering.id),
    )
    const title = String(request.body.title || 'New SWINLEARN chat').trim().slice(0, 120)
    const thread = await prisma.swinlearnThread.create({
      data: {
        selectedOfferingIds,
        studentId: user.id,
        title: title || 'New SWINLEARN chat',
      },
    })

    response.status(201).json(mapSwinlearnThread(thread))
  }),
)

workspaceRouter.get(
  '/swinlearn/threads/:id',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const thread = await loadSwinlearnThread(user.id, request.params.id, {
      attachments: { orderBy: { createdAt: 'desc' } },
      messages: {
        include: {
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    })

    if (!thread) {
      sendError(response, 404, 'SWINLEARN thread was not found.')
      return
    }

    response.json(mapSwinlearnThread(thread))
  }),
)

workspaceRouter.patch(
  '/swinlearn/threads/:id',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const thread = await loadSwinlearnThread(user.id, request.params.id)

    if (!thread) {
      sendError(response, 404, 'SWINLEARN thread was not found.')
      return
    }

    const data = {}

    if ('title' in request.body) {
      const title = String(request.body.title ?? '').trim().slice(0, 120)

      if (title.length === 0) {
        sendError(response, 400, 'Chat name cannot be empty.')
        return
      }

      data.title = title
    }

    if ('pinned' in request.body) {
      data.pinned = Boolean(request.body.pinned)
    }

    if (Object.keys(data).length === 0) {
      sendError(response, 400, 'No chat updates were provided.')
      return
    }

    const updatedThread = await prisma.swinlearnThread.update({
      where: { id: thread.id },
      data,
    })

    response.json(mapSwinlearnThread(updatedThread))
  }),
)

workspaceRouter.delete(
  '/swinlearn/threads/:id',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const thread = await loadSwinlearnThread(user.id, request.params.id)

    if (!thread) {
      sendError(response, 404, 'SWINLEARN thread was not found.')
      return
    }

    await prisma.swinlearnThread.delete({
      where: { id: thread.id },
    })

    response.json({ success: true })
  }),
)

workspaceRouter.post(
  '/swinlearn/threads/:id/messages',
  swinlearnUpload.array('files'),
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const thread = await loadSwinlearnThread(user.id, request.params.id)

    if (!thread) {
      sendError(response, 404, 'SWINLEARN thread was not found.')
      return
    }

    const message = requireBodyString(request.body, 'message')
    const offerings = await loadSwinlearnContext(prisma, user.id)
    const selectedOfferingIds = readSelectedOfferingIds(
      request.body,
      offerings.map((offering) => offering.id),
    )
    const userMessage = await prisma.swinlearnMessage.create({
      data: {
        content: message,
        role: 'student',
        selectedOfferingIds,
        threadId: thread.id,
      },
    })
    const groq = createSwinlearnGroqClient()
    const rag = createSwinlearnRagServices()
    const {
      attachments,
      documents: uploadDocuments,
      imageInputs,
    } = await createSwinlearnAttachments({
      files: request.files ?? [],
      groq,
      messageId: userMessage.id,
      rag,
      thread,
      userId: user.id,
    })
    const courseScope = resolveMessageCourseScope({
      message,
      offerings,
      poolOfferingIds: selectedOfferingIds,
    })
    const scopedOfferingIds = courseScope.scopedOfferingIds
    const courseLabels = offerings
      .filter((offering) => scopedOfferingIds.includes(offering.id))
      .map((offering) => `${offering.course.code} - ${offering.course.title}`)
    const history = await loadThreadMessages(thread.id)
    const gradeAnalysisContext = detectGradeAnalysisThreadContext(history)
    const responseLocale = detectLanguage(message)
    const cvThreadContext = detectCvThreadContext(history)
    const explicitUiIntent = String(request.body.intent ?? '').trim()
    const assignmentIds = readAssignmentIds(request.body)
    const perfectCvRequest = explicitUiIntent === UI_INTENTS.perfect_cv

    const route =
      buildExplicitRoute(explicitUiIntent) ??
      (await routeIntent({
        contextHint: gradeAnalysisContext?.state,
        groqApiKey: process.env.GROQ_API_KEY,
        message,
      }))

    const handlerResult = await handleSwinlearnMessage({
      assignmentIds,
      courseLabels,
      courseScope,
      cvThreadContext,
      explicitUiIntent,
      gradeAnalysisContext,
      groq,
      history,
      imageInputs,
      loadOfferingKnowledgeImpl: loadOfferingKnowledge,
      message,
      offerings,
      perfectCvRequest,
      prisma,
      rag,
      responseLocale,
      route,
      scopedOfferingIds,
      selectedOfferingIds,
      studentId: user.id,
      thread,
      uploadDocuments,
      userId: user.id,
    })

    const assistantMessage = await prisma.swinlearnMessage.create({
      data: {
        citations: handlerResult.citations,
        content: handlerResult.assistantText,
        metadata: handlerResult.metadata,
        model: handlerResult.model,
        openaiResponseId: handlerResult.providerResponseId,
        role: 'assistant',
        selectedOfferingIds,
        threadId: thread.id,
      },
    })

    await prisma.swinlearnThread.update({
      where: { id: thread.id },
      data: {
        selectedOfferingIds,
        title: thread.title === 'New SWINLEARN chat' ? message.slice(0, 80) : thread.title,
        updatedAt: new Date(),
      },
    })

    response.status(201).json({
      attachments: attachments.map(mapSwinlearnAttachment),
      assistant: mapSwinlearnMessage(assistantMessage),
      user: mapSwinlearnMessage({
        ...userMessage,
        attachments,
      }),
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
  '/academic-progress',
  asyncHandler(async (request, response) => {
    const context = await requireStudentRegistrationContext(request, response)

    if (!context?.student) {
      return
    }

    response.json(
      buildGradeReport(
        buildStudentProgress({
          student: context.student,
          courses: context.courses,
          curriculumRules: context.curriculumRules,
          childMajors: context.childMajors,
          completions: context.completions,
        }),
      ),
    )
  }),
)

const resolveGradeExportStudentInfo = async (student) => {
  if (!student) {
    return { fullName: '', studentId: '', major: '' }
  }

  // A student may only have a child major set; fall back to the child major's
  // parent relation to surface the main major (e.g. "Computer Science").
  const childMajor = student.child_major_id
    ? await prisma.childMajor.findUnique({
        where: { id: student.child_major_id },
        include: { mainMajor: true },
      })
    : null
  const mainMajor = student.main_major_id
    ? await prisma.mainMajor.findUnique({ where: { id: student.main_major_id } })
    : childMajor?.mainMajor ?? null

  const parts = [mainMajor?.title, childMajor?.title].filter(Boolean)

  return {
    fullName: student.full_name ?? '',
    studentId: student.student_id ?? '',
    major: parts.join(' - '),
  }
}

workspaceRouter.get(
  '/academic-progress/export',
  asyncHandler(async (request, response) => {
    const context = await requireStudentRegistrationContext(request, response)

    if (!context?.student) {
      return
    }

    const report = buildGradeReport(
      buildStudentProgress({
        student: context.student,
        courses: context.courses,
        curriculumRules: context.curriculumRules,
        childMajors: context.childMajors,
        completions: context.completions,
      }),
    )
    const studentInfo = await resolveGradeExportStudentInfo(context.student)
    const buffer = await buildGradeReportWorkbook(report, studentInfo)

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${gradeReportWorkbookFilename()}"`,
    )
    response.send(Buffer.from(buffer))
  }),
)

workspaceRouter.get(
  '/academic-progress/export/pdf',
  asyncHandler(async (request, response) => {
    const context = await requireStudentRegistrationContext(request, response)

    if (!context?.student) {
      return
    }

    const report = buildGradeReport(
      buildStudentProgress({
        student: context.student,
        courses: context.courses,
        curriculumRules: context.curriculumRules,
        childMajors: context.childMajors,
        completions: context.completions,
      }),
    )
    const studentInfo = await resolveGradeExportStudentInfo(context.student)
    const buffer = await buildGradeReportPdf(report, studentInfo)

    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${gradeReportPdfFilename()}"`,
    )
    response.send(Buffer.from(buffer))
  }),
)

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

    await markSwinlearnIndexesStaleForOffering(prisma, assignment.offeringId)

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

    await markSwinlearnIndexesStaleForOffering(prisma, assignment.offeringId)

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

    const assignment = await prisma.assignment.findUnique({
      where: { id: request.params.id },
      include: {
        offering: {
          include: {
            course: true,
          },
        },
      },
    })

    if (!assignment) {
      sendError(response, 404, 'Assignment was not found.')
      return
    }

    const body = String(request.body.body ?? '')
    const githubUrl = parseGithubRepoUrl(body)?.url ?? null
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
    let submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: request.params.id,
          studentId: user.id,
        },
      },
      update: {
        body,
        filePaths: [...existingPaths, ...filePaths],
        githubUrl,
        indexStatus: 'pending',
        indexError: null,
        submittedAt: new Date(),
      },
      create: {
        assignmentId: request.params.id,
        studentId: user.id,
        body,
        filePaths,
        githubUrl,
      },
    })

    try {
      submission = await indexAssignmentSubmission({
        assignment,
        embedder: swinlearnRag.embedder,
        offering: assignment.offering,
        prisma,
        studentId: user.id,
        submission,
        vectorStore: swinlearnRag.vectorStore,
      })
    } catch (error) {
      submission = await prisma.assignmentSubmission.update({
        where: { id: submission.id },
        data: {
          indexError: error instanceof Error ? error.message : 'Indexing failed.',
          indexStatus: 'error',
        },
      })
    }

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

const connectionPairWhere = (id1, id2) => {
  const { userAId, userBId } = orderPair(id1, id2)

  return { userAId_userBId: { userAId, userBId } }
}

const loadPairConnection = (id1, id2) =>
  prisma.connection.findUnique({
    where: connectionPairWhere(id1, id2),
    include: { userA: true, userB: true },
  })

const annotatePeople = async (currentUser, users) => {
  const ids = users.map((user) => user.id)

  if (ids.length === 0) {
    return []
  }

  const myOfferingIds = await visibleOfferingIds(currentUser)
  const [connections, coEnrollments, coStaff] = await Promise.all([
    prisma.connection.findMany({
      where: {
        OR: [
          { userAId: currentUser.id, userBId: { in: ids } },
          { userBId: currentUser.id, userAId: { in: ids } },
        ],
      },
    }),
    myOfferingIds.length
      ? prisma.enrollment.findMany({
          where: { offeringId: { in: myOfferingIds }, userId: { in: ids } },
          select: { userId: true },
        })
      : Promise.resolve([]),
    myOfferingIds.length
      ? prisma.courseStaff.findMany({
          where: { offeringId: { in: myOfferingIds }, userId: { in: ids } },
          select: { userId: true },
        })
      : Promise.resolve([]),
  ])
  const connectionByOther = new Map()

  for (const connection of connections) {
    const otherId = connection.userAId === currentUser.id ? connection.userBId : connection.userAId
    connectionByOther.set(otherId, connection)
  }

  const sharedIds = new Set([
    ...coEnrollments.map((row) => row.userId),
    ...coStaff.map((row) => row.userId),
  ])

  return users.map((user) => {
    const connection = connectionByOther.get(user.id) ?? null

    return {
      user: mapUserProfile(user),
      connection_state: connectionStateFor(currentUser.id, connection),
      connection_id: connection?.id ?? null,
      shared: sharedIds.has(user.id),
    }
  })
}

workspaceRouter.get(
  '/inbox/badge',
  asyncHandler(async (request, response) => {
    response.json(await countInboxBadge(prisma, request.currentUser.id))
  }),
)

workspaceRouter.get(
  '/inbox',
  asyncHandler(async (request, response) => {
    const currentUserId = request.currentUser.id
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
              participants: { include: { user: true } },
              messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      prisma.connection.findMany({
        where: {
          status: { in: ['pending', 'accepted'] },
          OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
        },
        include: { userA: true, userB: true },
        orderBy: { requestedAt: 'desc' },
      }),
    ])

    response.json({
      conversations: threads
        .filter((thread) => {
          const me = thread.participants.find(
            (participant) => participant.userId === currentUserId,
          )

          return isThreadVisible(me, thread.messages ?? [])
        })
        .map((thread) => mapConversation(thread, currentUserId)),
      connections: connections.map((connection) => mapConnection(connection, currentUserId)),
    })
  }),
)

workspaceRouter.get(
  '/inbox/people',
  asyncHandler(async (request, response) => {
    const currentUser = request.currentUser
    const courseId = String(request.query.course_id ?? '').trim()
    const query = String(request.query.query ?? '').trim()

    if (courseId) {
      const offering = await prisma.courseOffering.findFirst({
        where: { id: courseId, ...visibleOfferingWhere(currentUser) },
        include: { staff: true, enrollments: true },
      })

      if (!offering) {
        sendError(response, 404, 'Course was not found.')
        return
      }

      const memberIds = [
        ...new Set([
          ...offering.staff.map((member) => member.userId),
          ...offering.enrollments.map((member) => member.userId),
        ]),
      ].filter((id) => id !== currentUser.id)
      const members = memberIds.length
        ? await prisma.user.findMany({
            where: buildPersonSearchWhere({
              currentUserId: currentUser.id,
              memberIds,
              query,
            }),
            orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
          })
        : []

      response.json({ results: await annotatePeople(currentUser, members) })
      return
    }

    if (query.length === 0) {
      response.json({ results: [] })
      return
    }

    const users = await prisma.user.findMany({
      where: buildPersonSearchWhere({
        currentUserId: currentUser.id,
        query,
      }),
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      take: 20,
    })

    response.json({ results: await annotatePeople(currentUser, users) })
  }),
)

workspaceRouter.post(
  '/inbox/connections',
  asyncHandler(async (request, response) => {
    const requester = request.currentUser
    const addresseeId = requireBodyString(request.body, 'addressee_id')
    const addressee = await prisma.user.findUnique({ where: { id: addresseeId } })
    const existing = await loadPairConnection(requester.id, addresseeId)

    assertCanRequestConnection({ requester, addressee, existing })

    const { userAId, userBId } = orderPair(requester.id, addresseeId)
    const connection = await prisma.connection.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {
        requestedById: requester.id,
        status: 'pending',
        requestedAt: new Date(),
        decidedAt: null,
      },
      create: { userAId, userBId, requestedById: requester.id, status: 'pending' },
      include: { userA: true, userB: true },
    })

    response.status(201).json(mapConnection(connection, requester.id))
  }),
)

const decideConnection = async (request, response, nextStatus) => {
  const currentUserId = request.currentUser.id
  const connection = await prisma.connection.findUnique({
    where: { id: request.params.id },
    include: { userA: true, userB: true },
  })

  if (!connection || (connection.userAId !== currentUserId && connection.userBId !== currentUserId)) {
    sendError(response, 404, 'Connection request was not found.')
    return
  }

  if (connection.requestedById === currentUserId) {
    sendError(response, 403, 'You cannot respond to your own request.')
    return
  }

  if (connection.status !== 'pending') {
    sendError(response, 409, 'This request is no longer pending.')
    return
  }

  const updated =
    nextStatus === 'accepted'
      ? await acceptConnectionWithWelcomeMessage(prisma, {
          connection,
          accepterId: currentUserId,
        })
      : await prisma.connection.update({
          where: { id: connection.id },
          data: { status: nextStatus, decidedAt: new Date() },
          include: { userA: true, userB: true },
        })

  response.json(mapConnection(updated, currentUserId))
}

workspaceRouter.post(
  '/inbox/connections/:id/accept',
  asyncHandler((request, response) => decideConnection(request, response, 'accepted')),
)

workspaceRouter.post(
  '/inbox/connections/:id/decline',
  asyncHandler((request, response) => decideConnection(request, response, 'declined')),
)

workspaceRouter.delete(
  '/inbox/connections/:id',
  asyncHandler(async (request, response) => {
    const currentUserId = request.currentUser.id
    const connection = await prisma.connection.findUnique({ where: { id: request.params.id } })

    if (!connection || connection.requestedById !== currentUserId) {
      sendError(response, 404, 'Connection request was not found.')
      return
    }

    if (connection.status !== 'pending') {
      sendError(response, 409, 'Only pending requests can be cancelled.')
      return
    }

    await prisma.connection.delete({ where: { id: connection.id } })

    response.json({ success: true })
  }),
)

const loadThreadParticipant = (threadId, userId) =>
  prisma.inboxThreadParticipant.findUnique({
    where: {
      threadId_userId: {
        threadId,
        userId,
      },
    },
  })

workspaceRouter.post(
  '/inbox/groups',
  asyncHandler(async (request, response) => {
    const creator = request.currentUser
    const name = requireBodyString(request.body, 'name').trim()
    const memberIds = request.body.member_ids

    if (!Array.isArray(memberIds)) {
      sendError(response, 400, 'member_ids must be an array.')
      return
    }

    if (name.length === 0) {
      sendError(response, 400, 'Group name is required.')
      return
    }

    const uniqueMemberIds = assertCanCreateGroup({ creator, memberIds })

    for (const memberId of uniqueMemberIds) {
      const member = await prisma.user.findUnique({ where: { id: memberId } })
      const connection = await loadPairConnection(creator.id, memberId)

      assertCanAddGroupMember({ creator, member, connection })
    }

    const thread = await prisma.inboxThread.create({
      data: {
        subject: name,
        isGroup: true,
        pairKey: null,
        createdById: creator.id,
        participants: {
          create: [
            { userId: creator.id, lastReadAt: new Date() },
            ...uniqueMemberIds.map((userId) => ({ userId })),
          ],
        },
      },
    })

    response.status(201).json({ id: thread.id })
  }),
)

workspaceRouter.post(
  '/inbox/conversations',
  asyncHandler(async (request, response) => {
    const sender = request.currentUser
    const recipientId = requireBodyString(request.body, 'recipient_id')
    const target = await prisma.user.findUnique({ where: { id: recipientId } })
    const connection = await loadPairConnection(sender.id, recipientId)

    assertCanOpenConversation({ sender, target, connection })

    const { thread, created } = await ensureDirectConversation(prisma, sender.id, recipientId)

    response.status(created ? 201 : 200).json({ id: thread.id })
  }),
)

workspaceRouter.post(
  '/inbox/conversations/:id/messages',
  asyncHandler(async (request, response) => {
    const { body, gifUrl } = assertInboxMessageContent({
      body: request.body.body,
      gifUrl: request.body.gif_url,
    })
    const participant = await prisma.inboxThreadParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId: request.params.id,
          userId: request.currentUser.id,
        },
      },
    })

    if (!participant) {
      sendError(response, 403, 'You are not part of this conversation.')
      return
    }

    await prisma.$transaction([
      prisma.inboxMessage.create({
        data: {
          threadId: request.params.id,
          senderId: request.currentUser.id,
          body,
          gifUrl,
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
        data: { lastReadAt: new Date() },
      }),
    ])

    response.json({ success: true })
  }),
)

workspaceRouter.patch(
  '/inbox/conversations/:id/read',
  asyncHandler(async (request, response) => {
    await prisma.inboxThreadParticipant.updateMany({
      where: {
        threadId: request.params.id,
        userId: request.currentUser.id,
      },
      data: { lastReadAt: new Date() },
    })

    response.json({ success: true })
  }),
)

workspaceRouter.patch(
  '/inbox/conversations/:id',
  asyncHandler(async (request, response) => {
    const participant = await loadThreadParticipant(request.params.id, request.currentUser.id)

    if (!participant) {
      sendError(response, 403, 'You are not part of this conversation.')
      return
    }

    const data = {}

    if ('color' in request.body) {
      data.color = assertValidInboxColor(request.body.color)
    }

    if ('name' in request.body) {
      const name = String(request.body.name ?? '').trim()

      if (name.length === 0) {
        sendError(response, 400, 'Conversation name cannot be empty.')
        return
      }

      data.subject = name
    }

    if (Object.keys(data).length === 0) {
      sendError(response, 400, 'No conversation updates were provided.')
      return
    }

    const thread = await prisma.inboxThread.update({
      where: { id: request.params.id },
      data,
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    response.json(mapConversation(thread, request.currentUser.id))
  }),
)

workspaceRouter.patch(
  '/inbox/conversations/:id/nickname',
  asyncHandler(async (request, response) => {
    const participant = await loadThreadParticipant(request.params.id, request.currentUser.id)

    if (!participant) {
      sendError(response, 403, 'You are not part of this conversation.')
      return
    }

    const targetUserId = requireBodyString(request.body, 'target_user_id')
    const targetParticipant = await loadThreadParticipant(request.params.id, targetUserId)

    if (!targetParticipant) {
      sendError(response, 404, 'Participant was not found in this conversation.')
      return
    }

    const nickname =
      request.body.nickname === null || request.body.nickname === undefined
        ? null
        : String(request.body.nickname).trim() || null

    await prisma.inboxThreadParticipant.update({
      where: {
        threadId_userId: {
          threadId: request.params.id,
          userId: targetUserId,
        },
      },
      data: { nickname },
    })

    const thread = await prisma.inboxThread.findUnique({
      where: { id: request.params.id },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    response.json(mapConversation(thread, request.currentUser.id))
  }),
)

workspaceRouter.delete(
  '/inbox/conversations/:id',
  asyncHandler(async (request, response) => {
    const participant = await loadThreadParticipant(request.params.id, request.currentUser.id)

    if (!participant) {
      sendError(response, 403, 'You are not part of this conversation.')
      return
    }

    await prisma.inboxThreadParticipant.update({
      where: {
        threadId_userId: {
          threadId: request.params.id,
          userId: request.currentUser.id,
        },
      },
      data: { hiddenAt: new Date() },
    })

    response.json({ success: true })
  }),
)

workspaceRouter.get(
  '/help/teachers',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student'])

    if (!user) {
      return
    }

    const teachers = await listTeachersForConsultation(prisma, user.id)
    response.json(teachers.map(mapConsultationTeacher))
  }),
)

workspaceRouter.get(
  '/help/requests',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student', 'teacher'])

    if (!user) {
      return
    }

    const requests = await listHelpRequestsForUser(prisma, user.id)
    response.json(requests.map(mapHelpRequest))
  }),
)

workspaceRouter.post(
  '/help/requests',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student', 'teacher'])

    if (!user) {
      return
    }

    const helpRequest = await submitHelpRequest(prisma, {
      requester: user,
      topic: request.body.topic,
      details: request.body.details,
      teacherId: request.body.teacher_id ? String(request.body.teacher_id) : null,
      consultationDate: request.body.consultation_date,
      consultationTime: request.body.consultation_time,
      offeringId: request.body.offering_id ? String(request.body.offering_id) : null,
    })

    response.status(201).json(mapHelpRequest(helpRequest))
  }),
)

workspaceRouter.get(
  '/help/requests/:id',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['student', 'teacher'])

    if (!user) {
      return
    }

    const helpRequest = await prisma.helpRequest.findFirst({
      where: {
        id: request.params.id,
        requesterId: user.id,
      },
      include: {
        requester: true,
        teacher: true,
        room: true,
        offering: { include: { course: true } },
      },
    })

    if (!helpRequest) {
      sendError(response, 404, 'Help request was not found.')
      return
    }

    response.json(mapHelpRequest(helpRequest))
  }),
)

workspaceRouter.get(
  '/help/teacher-requests',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['teacher'])

    if (!user) {
      return
    }

    const requests = await listHelpRequestsForTeacher(prisma, user.id)
    response.json(requests.map(mapHelpRequest))
  }),
)

workspaceRouter.post(
  '/help/requests/:id/respond',
  asyncHandler(async (request, response) => {
    const user = requireRole(request, response, ['teacher'])

    if (!user) {
      return
    }

    const accepted = Boolean(request.body.accepted)
    const helpRequest = await respondAsTeacher(prisma, {
      requestId: request.params.id,
      teacherId: user.id,
      accepted,
    })

    response.json(mapHelpRequest(helpRequest))
  }),
)
